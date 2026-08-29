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

type ProjectStatus =
  | "draft"
  | "active"
  | "archived";

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
 * Requires the user to have the system administrator role.
 *
 * @param {string} uid Firebase Auth user ID.
 */
async function requireSystemAdmin(
  uid: string,
): Promise<void> {
  const snapshot =
    await db
      .doc(`users/${uid}`)
      .get();

  if (
    !snapshot.exists ||
    snapshot.data()?.systemRole !==
      "admin"
  ) {
    throw new HttpsError(
      "permission-denied",
      "Only cxTools administrators can create projects.",
    );
  }
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

/**
 * Validates and returns a project name.
 *
 * @param {*} value Project name value to validate.
 * @return {string} Validated project name.
 */
function requireProjectName(
  value: unknown,
): string {
  if (
    typeof value !== "string"
  ) {
    throw new HttpsError(
      "invalid-argument",
      "A project name is required.",
    );
  }

  const name =
    value.trim();

  if (
    name.length < 2 ||
    name.length > 120
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Project name must be between 2 and 120 characters.",
    );
  }

  return name;
}

/**
 * Converts a project name into a project ID slug.
 *
 * @param {string} value Project name to convert.
 * @return {string} Project ID slug.
 */
function projectSlug(
  value: string,
): string {
  const slug =
    value
      .toLowerCase()
      .trim()
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      )
      .slice(
        0,
        80,
      );

  if (!slug) {
    throw new HttpsError(
      "invalid-argument",
      "The project name could not be converted into a valid project ID.",
    );
  }

  return slug;
}

/**
 * Validates and returns a floor ID.
 *
 * @param {*} value Floor ID value to validate.
 * @return {string} Validated floor ID.
 */
function requireFloorId(
  value: unknown,
): string {
  if (
    typeof value !== "string"
  ) {
    throw new HttpsError(
      "invalid-argument",
      "A floor ID is required.",
    );
  }

  const floorId =
    value.trim();

  if (
    !/^[A-Za-z0-9_-]{1,20}$/.test(
      floorId,
    )
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Floor ID may only contain letters, numbers, hyphens and underscores.",
    );
  }

  return floorId;
}

/**
 * Validates and returns a floor label.
 *
 * @param {*} value Floor label value to validate.
 * @return {string} Validated floor label.
 */
function requireFloorLabel(
  value: unknown,
): string {
  if (
    typeof value !== "string"
  ) {
    throw new HttpsError(
      "invalid-argument",
      "A floor label is required.",
    );
  }

  const label =
    value.trim();

  if (
    label.length < 1 ||
    label.length > 80
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Floor label must be between 1 and 80 characters.",
    );
  }

  return label;
}

export const grantProjectAccess =
  onCall(
    {
      invoker: "public",
    },
    async (request) => {
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
    },
  );

export const claimProjectInvites =
  onCall(
    {
      invoker: "public",
    },
    async (request) => {
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
    },
  );

export const revokeProjectAccess =
  onCall(
    {
      invoker: "public",
    },
    async (request) => {
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
    },
  );

export const listProjectPeople =
  onCall(
    {
      invoker: "public",
    },
    async (request) => {
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
    },
  );

export const createProject =
  onCall(
    {
      invoker: "public",
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in before creating a project.",
        );
      }

      await requireSystemAdmin(
        request.auth.uid,
      );

      const name =
        requireProjectName(
          request.data?.name,
        );

      const description =
        typeof request.data?.description ===
        "string" ?
          request.data.description
            .trim()
            .slice(0, 500) :
          "";

      const code =
        typeof request.data?.code ===
        "string" ?
          request.data.code
            .trim()
            .slice(0, 40) :
          "";

      const spreadsheetId =
        typeof request.data?.spreadsheetId ===
        "string" ?
          request.data.spreadsheetId
            .trim() :
          "";

      const baseProjectId =
        projectSlug(name);

      /*
       * Start with the clean project slug.
       */
      let projectId =
        baseProjectId;

      let projectRef =
        db.doc(
          `projects/${projectId}`,
        );

      let snapshot =
        await projectRef.get();

      /*
       * If already taken, append a small
       * unique suffix.
       */
      if (snapshot.exists) {
        const suffix =
          Math.random()
            .toString(36)
            .slice(2, 7);

        projectId =
          `${baseProjectId}-${suffix}`;

        projectRef =
          db.doc(
            `projects/${projectId}`,
          );

        snapshot =
          await projectRef.get();

        if (snapshot.exists) {
          throw new HttpsError(
            "already-exists",
            [
              "A project with this name already exists.",
              "Try a slightly different name.",
            ].join(" "),
          );
        }
      }

      const uid =
        request.auth.uid;

      const email =
        typeof request.auth.token.email ===
        "string" ?
          request.auth.token.email :
          "";

      const displayName =
        typeof request.auth.token.name ===
        "string" ?
          request.auth.token.name :
          "";

      const userRef =
        db.doc(
          `users/${uid}`,
        );

      const membershipRef =
        db.doc(
          `users/${uid}/memberships/${projectId}`,
        );

      const memberRef =
        db.doc(
          `projects/${projectId}/members/${uid}`,
        );

      const auditRef =
        db.collection(
          `projects/${projectId}/auditEvents`,
        ).doc();

      const batch =
        db.batch();

      batch.set(
        projectRef,
        {
          name,

          code,

          description,

          spreadsheetId,

          status:
            "draft" satisfies ProjectStatus,

          createdBy:
            uid,

          createdAt:
            FieldValue.serverTimestamp(),

          updatedBy:
            uid,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
      );

      batch.set(
        userRef,
        {
          email,
          displayName,
        },
        {
          merge: true,
        },
      );

      batch.set(
        membershipRef,
        {
          projectId,

          role: "admin",

          active: true,

          email,

          updatedBy:
            uid,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
      );

      batch.set(
        memberRef,
        {
          uid,

          email,

          displayName,

          role: "admin",

          active: true,

          updatedBy:
            uid,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
      );

      batch.set(
        auditRef,
        {
          eventType:
            "project_created",

          performedBy:
            uid,

          projectId,

          projectName:
            name,

          createdAt:
            FieldValue.serverTimestamp(),
        },
      );

      await batch.commit();

      return {
        projectId,

        project: {
          id:
            projectId,

          name,

          code,

          description,

          spreadsheetId,

          status:
            "draft",
        },
      };
    },
  );

export const upsertProjectFloor =
  onCall(
    {
      invoker: "public",
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in before editing project setup.",
        );
      }

      const projectId =
        requireProjectId(
          request.data?.projectId,
        );

      const floorId =
        requireFloorId(
          request.data?.floorId,
        );

      const label =
        requireFloorLabel(
          request.data?.label,
        );

      const orderValue =
        request.data?.order;

      const order =
        typeof orderValue ===
          "number" &&
        Number.isFinite(orderValue) ?
          Math.trunc(orderValue) :
          0;

      await requireProjectAdmin(
        request.auth.uid,
        projectId,
      );

      const projectRef =
        db.doc(
          `projects/${projectId}`,
        );

      const projectSnapshot =
        await projectRef.get();

      if (!projectSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "The selected project could not be found.",
        );
      }

      const floorRef =
        db.doc(
          `projects/${projectId}/floors/${floorId}`,
        );

      const auditRef =
        db.collection(
          `projects/${projectId}/auditEvents`,
        ).doc();

      const batch =
        db.batch();

      batch.set(
        floorRef,
        {
          label,
          order,

          /*
           * These are populated in
           * the next setup step.
           */
          spacesUrl: "",
          regionsUrl: "",
          panelTestsUrl: "",

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
        projectRef,
        {
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
        auditRef,
        {
          eventType:
            "project_floor_saved",

          floorId,
          floorLabel:
            label,

          performedBy:
            request.auth.uid,

          createdAt:
            FieldValue.serverTimestamp(),
        },
      );

      await batch.commit();

      return {
        floor: {
          id:
            floorId,

          label,

          order,
        },
      };
    },
  );

export const listAdminProjects =
  onCall(
    {
      invoker: "public",
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in before viewing project administration.",
        );
      }

      await requireSystemAdmin(
        request.auth.uid,
      );

      const projectSnapshot =
        await db
          .collection("projects")
          .get();

      const projects =
        projectSnapshot.docs.map(
          (projectDoc) => {
            const data =
              projectDoc.data();

            return {
              id: projectDoc.id,

              name:
                typeof data.name ===
                "string" ?
                  data.name :
                  projectDoc.id,

              code:
                typeof data.code ===
                "string" ?
                  data.code :
                  "",

              description:
                typeof data.description ===
                "string" ?
                  data.description :
                  "",

              spreadsheetId:
                typeof data.spreadsheetId ===
                "string" ?
                  data.spreadsheetId :
                  "",

              status:
                data.status === "draft" ||
                data.status === "archived" ?
                  data.status :
                  "active",
            };
          },
        );

      projects.sort(
        (a, b) =>
          a.name.localeCompare(
            b.name,
          ),
      );

      return {
        projects,
      };
    },
  );

export const commitCommissioningImport =
  onCall(
    {
      invoker: "public",
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in before importing commissioning data.",
        );
      }

      const projectId =
        requireProjectId(
          request.data?.projectId,
        );

      await requireProjectAdmin(
        request.auth.uid,
        projectId,
      );

      const projectRef =
        db.doc(
          `projects/${projectId}`,
        );

      const projectSnapshot =
        await projectRef.get();

      if (
        !projectSnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "The project could not be found.",
        );
      }

      if (
        projectSnapshot.data()
          ?.status !== "draft"
      ) {
        throw new HttpsError(
          "failed-precondition",
          [
            "Commissioning setup data can only be imported",
            "while the project is in draft.",
          ].join(" "),
        );
      }

      const inputFloors =
        request.data?.floors;

      if (
        !Array.isArray(
          inputFloors,
        ) ||
        inputFloors.length ===
          0
      ) {
        throw new HttpsError(
          "invalid-argument",
          "At least one floor is required.",
        );
      }

      const sourceWorkbookPath =
        typeof request.data
          ?.sourceWorkbookPath ===
        "string" ?
          request.data
            .sourceWorkbookPath :
          "";

      const expectedSourcePrefix =
        `projects/${projectId}/source/`;

      if (
        !sourceWorkbookPath.startsWith(
          expectedSourcePrefix,
        )
      ) {
        throw new HttpsError(
          "invalid-argument",
          "The source workbook path is invalid.",
        );
      }

      const batch =
        db.batch();

      for (
        const inputFloor
        of inputFloors
      ) {
        const floorId =
          requireFloorId(
            inputFloor?.floorId,
          );

        const spacesUrl =
          typeof inputFloor
            ?.spacesUrl ===
          "string" ?
            inputFloor
              .spacesUrl :
            "";

        const panelTestsUrl =
          typeof inputFloor
            ?.panelTestsUrl ===
          "string" ?
            inputFloor
              .panelTestsUrl :
            "";

        const expectedPrefix =
          `projects/${projectId}/floors/${floorId}/data/`;

        if (
          spacesUrl !==
          `${expectedPrefix}spaces.json`
        ) {
          throw new HttpsError(
            "invalid-argument",
            `Invalid spaces path for Floor ${floorId}.`,
          );
        }

        if (
          panelTestsUrl !==
          `${expectedPrefix}panel-tests.json`
        ) {
          throw new HttpsError(
            "invalid-argument",
            `Invalid panel testing path for Floor ${floorId}.`,
          );
        }

        const floorRef =
          db.doc(
            `projects/${projectId}/floors/${floorId}`,
          );

        const floorSnapshot =
          await floorRef.get();

        if (
          !floorSnapshot.exists
        ) {
          throw new HttpsError(
            "not-found",
            `Floor ${floorId} does not exist.`,
          );
        }

        batch.set(
          floorRef,
          {
            spacesUrl,
            panelTestsUrl,
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

      batch.set(
        projectRef,
        {
          commissioningSourcePath:
            sourceWorkbookPath,
          commissioningDataImported:
            true,
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
        db.collection(
          `projects/${projectId}/auditEvents`,
        ).doc(),
        {
          eventType:
            "commissioning_data_imported",
          sourceWorkbookPath,
          floorCount:
            inputFloors.length,
          performedBy:
            request.auth.uid,
          createdAt:
            FieldValue.serverTimestamp(),
        },
      );

      await batch.commit();
      return {
        success: true,
      };
    },
  );

export const commitProjectFloorAssets =
  onCall(
    {
      invoker: "public",
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in before updating project files.",
        );
      }

      const projectId =
        requireProjectId(
          request.data?.projectId,
        );

      const floorId =
        requireFloorId(
          request.data?.floorId,
        );

      await requireProjectAdmin(
        request.auth.uid,
        projectId,
      );

      const planPath =
        typeof request.data
          ?.planPath ===
        "string" ?
          request.data
            .planPath :
          "";

      const regionsUrl =
        typeof request.data
          ?.regionsUrl ===
        "string" ?
          request.data
            .regionsUrl :
          "";

      const expectedPlan =
        `projects/${projectId}/floors/${floorId}/plans/base.svg`;

      const expectedRegions =
        `projects/${projectId}/floors/${floorId}/data/regions.json`;

      if (
        planPath !==
        expectedPlan
      ) {
        throw new HttpsError(
          "invalid-argument",
          "The floor plan path is invalid.",
        );
      }

      if (
        regionsUrl !==
        expectedRegions
      ) {
        throw new HttpsError(
          "invalid-argument",
          "The region file path is invalid.",
        );
      }

      const floorRef =
        db.doc(
          `projects/${projectId}/floors/${floorId}`,
        );

      const snapshot =
        await floorRef.get();

      if (
        !snapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          `Floor ${floorId} does not exist.`,
        );
      }

      await floorRef.set(
        {
          planPath,
          regionsUrl,
          updatedBy:
            request.auth.uid,
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        },
      );

      await db
        .collection(
          `projects/${projectId}/auditEvents`,
        )
        .add({
          eventType:
            "floor_visual_assets_saved",
          floorId,
          performedBy:
            request.auth.uid,
          createdAt:
            FieldValue.serverTimestamp(),
        });

      return {
        success: true,
      };
    },
  );

export const configureProjectSpreadsheet =
  onCall(
    {
      invoker: "public",
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "Sign in before configuring the project spreadsheet.",
        );
      }

      const projectId =
        requireProjectId(
          request.data
            ?.projectId,
        );

      await requireProjectAdmin(
        request.auth.uid,
        projectId,
      );

      const spreadsheetId =
        typeof request.data
          ?.spreadsheetId ===
        "string" ?
          request.data
            .spreadsheetId
            .trim() :
          "";

      const spreadsheetName =
        typeof request.data
          ?.spreadsheetName ===
        "string" ?
          request.data
            .spreadsheetName
            .trim()
            .slice(
              0,
              200,
            ) :
          "";

      if (
        !/^[a-zA-Z0-9-_]{20,}$/.test(
          spreadsheetId,
        )
      ) {
        throw new HttpsError(
          "invalid-argument",
          "The Google spreadsheet ID is invalid.",
        );
      }

      const projectRef =
        db.doc(
          `projects/${projectId}`,
        );

      const snapshot =
        await projectRef.get();

      if (!snapshot.exists) {
        throw new HttpsError(
          "not-found",
          "The project could not be found.",
        );
      }

      if (
        snapshot.data()
          ?.status !==
        "draft"
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Spreadsheet setup can only be changed for draft projects.",
        );
      }

      const batch =
        db.batch();

      batch.set(
        projectRef,
        {
          spreadsheetId,

          spreadsheetName,

          googleSheetConfigured:
            true,

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
        db.collection(
          `projects/${projectId}/auditEvents`,
        ).doc(),
        {
          eventType:
            "project_spreadsheet_configured",

          spreadsheetId,

          spreadsheetName,

          performedBy:
            request.auth.uid,

          createdAt:
            FieldValue.serverTimestamp(),
        },
      );

      await batch.commit();

      return {
        success: true,
      };
    },
  );
