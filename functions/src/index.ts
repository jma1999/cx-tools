import {setGlobalOptions} from "firebase-functions/v2";

setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
});

/*
 * Secure callable functions will be added here
 * during the member-invitation phase.
 */

import {
  onCall,
  HttpsError,
} from "firebase-functions/v2/https";

import {
  initializeApp,
} from "firebase-admin/app";

import {
  getAuth,
} from "firebase-admin/auth";

import {
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";

import {
  createHash,
} from "node:crypto";

initializeApp();

const db = getFirestore();

type ProjectRole =
  | "admin"
  | "editor"
  | "viewer";

const VALID_ROLES =
  new Set<ProjectRole>([
    "admin",
    "editor",
    "viewer",
  ]);

/**
 * Validates and returns a project ID.
 *
 * @param {*} value Project ID value to validate.
 * @return {string} Validated project ID.
 */
function requireProjectId(
  value: unknown,
): string {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(
      value,
    )
  ) {
    throw new HttpsError(
      "invalid-argument",
      "A valid project ID is required.",
    );
  }

  return value;
}

/**
 * Normalizes and validates an email address.
 *
 * @param {*} value Email value to normalize and validate.
 * @return {string} Normalized email address.
 */
function requireEmail(
  value: unknown,
): string {
  if (
    typeof value !== "string"
  ) {
    throw new HttpsError(
      "invalid-argument",
      "An email address is required.",
    );
  }

  const email =
    value.trim().toLowerCase();

  if (
    !email ||
    !email.includes("@")
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Enter a valid email address.",
    );
  }

  return email;
}

/**
 * Validates and returns a project role.
 *
 * @param {*} value Project role value to validate.
 * @return {ProjectRole} Validated project role.
 */
function requireRole(
  value: unknown,
): ProjectRole {
  if (
    typeof value !== "string" ||
    !VALID_ROLES.has(
      value as ProjectRole,
    )
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Role must be admin, editor, or viewer.",
    );
  }

  return value as ProjectRole;
}

/**
 * Returns a stable SHA-256 hash for an email address.
 *
 * @param {string} email Email address to hash.
 * @return {string} SHA-256 hash of the email address.
 */
function emailHash(
  email: string,
): string {
  return createHash("sha256")
    .update(email)
    .digest("hex");
}

/**
 * Requires an active administrator membership for a project.
 *
 * @param {string} uid Firebase Auth user ID.
 * @param {string} projectId Project ID to check.
 */
async function requireProjectAdmin(
  uid: string,
  projectId: string,
): Promise<{
  email: string;
  role: ProjectRole;
}> {
  const membershipRef =
    db.doc(
      `users/${uid}/memberships/${projectId}`,
    );

  const snapshot =
    await membershipRef.get();

  if (!snapshot.exists) {
    throw new HttpsError(
      "permission-denied",
      "You do not have access to this project.",
    );
  }

  const data = snapshot.data();

  if (
    data?.active !== true ||
    data?.role !== "admin"
  ) {
    throw new HttpsError(
      "permission-denied",
      "Only project administrators can manage project access.",
    );
  }

  return {
    email:
      typeof data.email === "string" ?
        data.email :
        "",

    role: "admin",
  };
}

/**
 * Returns whether an error is an Auth user-not-found error.
 *
 * @param {*} error Error value to inspect.
 * @return {boolean} Whether the error is auth/user-not-found.
 */
function isUserNotFound(
  error: unknown,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (
      error as {
        code?: string;
      }
    ).code ===
      "auth/user-not-found"
  );
}

export const grantProjectAccess =
  onCall(async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Sign in before managing project access.",
      );
    }

    const projectId =
      requireProjectId(
        request.data?.projectId,
      );

    const email =
      requireEmail(
        request.data?.email,
      );

    const role =
      requireRole(
        request.data?.role,
      );

    await requireProjectAdmin(
      request.auth.uid,
      projectId,
    );

    /*
     * Don't allow an admin to accidentally
     * downgrade themselves.
     */
    const callerEmail =
      typeof request.auth.token.email ===
      "string" ?
        request.auth.token.email
          .trim()
          .toLowerCase() :
        "";

    if (
      callerEmail === email &&
      role !== "admin"
    ) {
      throw new HttpsError(
        "failed-precondition",
        "You cannot remove your own administrator role.",
      );
    }

    const inviteId =
      `${projectId}__${emailHash(
        email,
      )}`;

    const inviteRef =
      db.doc(
        `projectInvites/${inviteId}`,
      );

    try {
      const user =
        await getAuth()
          .getUserByEmail(email);

      const membershipRef =
        db.doc(
          `users/${user.uid}/memberships/${projectId}`,
        );

      const memberRef =
        db.doc(
          `projects/${projectId}/members/${user.uid}`,
        );

      const userRef =
        db.doc(
          `users/${user.uid}`,
        );

      const auditRef =
        db.collection(
          `projects/${projectId}/auditEvents`,
        ).doc();

      const batch =
        db.batch();

      batch.set(
        userRef,
        {
          email:
            user.email ?? email,

          displayName:
            user.displayName ?? "",
        },
        {
          merge: true,
        },
      );

      batch.set(
        membershipRef,
        {
          projectId,
          role,
          active: true,

          email:
            user.email ?? email,

          updatedBy:
            request.auth.uid,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        },
      );

      batch.set(
        memberRef,
        {
          uid: user.uid,

          email:
            user.email ?? email,

          displayName:
            user.displayName ?? "",

          role,
          active: true,

          updatedBy:
            request.auth.uid,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        },
      );

      /*
       * If they previously had a pending
       * invite, it's no longer needed.
       */
      batch.delete(
        inviteRef,
      );

      batch.set(
        auditRef,
        {
          eventType:
            "project_access_granted",

          targetUid:
            user.uid,

          targetEmail:
            user.email ?? email,

          role,

          performedBy:
            request.auth.uid,

          createdAt:
            FieldValue.serverTimestamp(),
        },
      );

      await batch.commit();

      return {
        status: "active",
        uid: user.uid,
        email:
          user.email ?? email,
        displayName:
          user.displayName ?? "",
        role,
      };
    } catch (error) {
      if (
        !isUserNotFound(error)
      ) {
        throw error;
      }
    }

    /*
     * User has never signed into the app.
     * Create a pending invitation instead.
     */
    const auditRef =
      db.collection(
        `projects/${projectId}/auditEvents`,
      ).doc();

    const batch =
      db.batch();

    batch.set(
      inviteRef,
      {
        projectId,

        email,

        emailHash:
          emailHash(email),

        role,

        status: "pending",

        createdBy:
          request.auth.uid,

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      },
    );

    batch.set(
      auditRef,
      {
        eventType:
          "project_invite_created",

        targetEmail: email,
        role,

        performedBy:
          request.auth.uid,

        createdAt:
          FieldValue.serverTimestamp(),
      },
    );

    await batch.commit();

    return {
      status: "pending",
      email,
      role,
    };
  });

export const claimProjectInvites =
  onCall(async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Sign in before claiming invitations.",
      );
    }

    const rawEmail =
      request.auth.token.email;

    if (
      typeof rawEmail !== "string"
    ) {
      return {
        claimed: 0,
      };
    }

    const email =
      rawEmail
        .trim()
        .toLowerCase();

    const hash =
      emailHash(email);

    const invites =
      await db
        .collection(
          "projectInvites",
        )
        .where(
          "emailHash",
          "==",
          hash,
        )
        .get();

    const pending =
      invites.docs.filter(
        (doc) =>
          doc.data().status ===
          "pending",
      );

    if (
      pending.length === 0
    ) {
      return {
        claimed: 0,
      };
    }

    const batch =
      db.batch();

    const userRef =
      db.doc(
        `users/${request.auth.uid}`,
      );

    batch.set(
      userRef,
      {
        email,

        displayName:
          request.auth.token.name ??
          "",
      },
      {
        merge: true,
      },
    );

    for (
      const inviteDoc of pending
    ) {
      const invite =
        inviteDoc.data();

      const projectId =
        requireProjectId(
          invite.projectId,
        );

      const role =
        requireRole(
          invite.role,
        );

      const membershipRef =
        db.doc(
          `users/${request.auth.uid}/memberships/${projectId}`,
        );

      const memberRef =
        db.doc(
          `projects/${projectId}/members/${request.auth.uid}`,
        );

      const auditRef =
        db.collection(
          `projects/${projectId}/auditEvents`,
        ).doc();

      batch.set(
        membershipRef,
        {
          projectId,
          role,
          active: true,

          email,

          updatedBy:
            request.auth.uid,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        },
      );

      batch.set(
        memberRef,
        {
          uid:
            request.auth.uid,

          email,

          displayName:
            request.auth.token.name ??
            "",

          role,
          active: true,

          updatedBy:
            request.auth.uid,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        },
      );

      batch.update(
        inviteDoc.ref,
        {
          status: "claimed",

          claimedBy:
            request.auth.uid,

          claimedAt:
            FieldValue.serverTimestamp(),
        },
      );

      batch.set(
        auditRef,
        {
          eventType:
            "project_invite_claimed",

          targetUid:
            request.auth.uid,

          targetEmail:
            email,

          role,

          createdAt:
            FieldValue.serverTimestamp(),
        },
      );
    }

    await batch.commit();

    return {
      claimed:
        pending.length,
    };
  });

export const revokeProjectAccess =
  onCall(async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Sign in before managing project access.",
      );
    }

    const projectId =
      requireProjectId(
        request.data?.projectId,
      );

    const email =
      requireEmail(
        request.data?.email,
      );

    await requireProjectAdmin(
      request.auth.uid,
      projectId,
    );

    const callerEmail =
      typeof request.auth.token.email ===
      "string" ?
        request.auth.token.email
          .trim()
          .toLowerCase() :
        "";

    /*
     * For now, never allow self-revocation.
     * This prevents accidentally locking
     * the project out of its only admin.
     */
    if (
      callerEmail === email
    ) {
      throw new HttpsError(
        "failed-precondition",
        "You cannot revoke your own project access.",
      );
    }

    const inviteId =
      `${projectId}__${emailHash(
        email,
      )}`;

    const inviteRef =
      db.doc(
        `projectInvites/${inviteId}`,
      );

    let user:
      Awaited<
        ReturnType<
          ReturnType<
            typeof getAuth
          >["getUserByEmail"]
        >
      > |
      null = null;

    try {
      user =
        await getAuth()
          .getUserByEmail(email);
    } catch (error) {
      if (
        !isUserNotFound(error)
      ) {
        throw error;
      }
    }

    const batch =
      db.batch();

    if (user) {
      batch.set(
        db.doc(
          `users/${user.uid}/memberships/${projectId}`,
        ),
        {
          active: false,

          updatedBy:
            request.auth.uid,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        },
      );

      batch.set(
        db.doc(
          `projects/${projectId}/members/${user.uid}`,
        ),
        {
          uid:
            user.uid,

          email:
            user.email ?? email,

          displayName:
            user.displayName ?? "",

          active: false,

          updatedBy:
            request.auth.uid,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        },
      );
    }

    /*
     * Also cancel an unclaimed invite,
     * if one exists.
     */
    batch.set(
      inviteRef,
      {
        projectId,
        email,

        emailHash:
          emailHash(email),

        status: "revoked",

        revokedBy:
          request.auth.uid,

        revokedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      },
    );

    batch.set(
      db.collection(
        `projects/${projectId}/auditEvents`,
      ).doc(),
      {
        eventType:
          "project_access_revoked",

        targetEmail:
          email,

        targetUid:
          user?.uid ?? "",

        performedBy:
          request.auth.uid,

        createdAt:
          FieldValue.serverTimestamp(),
      },
    );

    await batch.commit();

    return {
      success: true,
      email,
    };
  });

export const listProjectPeople =
  onCall(async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Sign in first.",
      );
    }

    const projectId =
      requireProjectId(
        request.data?.projectId,
      );

    const callerMembership =
      await requireProjectAdmin(
        request.auth.uid,
        projectId,
      );

    /*
     * Backfill the current admin into
     * the project-centric member index.
     */
    await db.doc(
      `projects/${projectId}/members/${request.auth.uid}`,
    ).set(
      {
        uid:
          request.auth.uid,

        email:
          callerMembership.email,

        role: "admin",

        active: true,

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      },
    );

    const [
      memberSnapshot,
      inviteSnapshot,
    ] = await Promise.all([
      db.collection(
        `projects/${projectId}/members`,
      ).get(),

      db.collection(
        "projectInvites",
      )
        .where(
          "projectId",
          "==",
          projectId,
        )
        .get(),
    ]);

    const members =
      memberSnapshot.docs
        .filter(
          (doc) =>
            doc.data().active === true,
        )
        .map((doc) => ({
          uid: doc.id,
          ...doc.data(),
        }));

    const pendingInvites =
      inviteSnapshot.docs
        .filter(
          (doc) =>
            doc.data().status ===
            "pending",
        )
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

    return {
      members,
      pendingInvites,
    };
  });
