import type {
  FloorRegion,
  PanelTestSpace,
} from "../../types/commissioning";

interface PanelTestingPanelProps {
  space: PanelTestSpace;
  region: FloorRegion;
  readOnly: boolean;
}

export default function PanelTestingPanel({
  space,
  region,
  readOnly,
}: PanelTestingPanelProps) {
  return (
    <>
      <div className="panel-heading inspection-panel-heading">
        <p className="eyebrow">
          Electrical panel testing
        </p>

        <h2>
          {space.roomNo ||
            region.label}
        </h2>

        <p>{space.displayName}</p>
      </div>

      {readOnly && (
        <div className="panel-readonly-message">
          <strong>
            Read-only access
          </strong>

          <span>
            You can review panel testing
            information but cannot record
            results.
          </span>
        </div>
      )}

      <div className="panel-test-summary">
        <div>
          <span>Panelboard</span>
          <strong>
            {space.panelboard}
          </strong>
        </div>

        {space.panelLocation && (
          <div>
            <span>Panel location</span>
            <strong>
              {space.panelLocation}
            </strong>
          </div>
        )}

        <div>
          <span>Circuits sampled</span>
          <strong>
            {space.circuits.length}
          </strong>
        </div>
      </div>

      {space.notes && (
        <div className="space-reference-note">
          <span>Testing notes</span>

          <p>{space.notes}</p>
        </div>
      )}

      {space.referenceImageUrl && (
        <section className="panel-reference-section">
          <div className="inspection-group-heading">
            <h3>
              Electrical plan reference
            </h3>
          </div>

          <img
            className="panel-reference-image"
            src={space.referenceImageUrl}
            alt={`Electrical plan reference for ${space.displayName}`}
          />
        </section>
      )}

      <section className="inspection-group">
        <div className="inspection-group-heading">
          <h3>
            Branch circuits
          </h3>

          <span>
            {space.circuits.length} circuits
          </span>
        </div>

        <div className="inspection-items">
          {space.circuits.map(
            (circuit) => (
              <article
                className="inspection-item-card"
                key={circuit.id}
              >
                <div className="inspection-item-title">
                  <div>
                    <strong>
                      Circuit{" "}
                      {circuit.circuitNo}
                    </strong>

                    <span>
                      {circuit.loadDescription}
                    </span>
                  </div>
                </div>

                <div className="fixture-reference-note">
                  <span>Test</span>

                  <p>
                    {circuit.testLabel}
                  </p>
                </div>

                {circuit.instructions && (
                  <div className="fixture-location-note">
                    <span>
                      Test instruction
                    </span>

                    <p>
                      {circuit.instructions}
                    </p>
                  </div>
                )}

                <div className="fixture-reference-note">
                  <span>
                    Expected result
                  </span>

                  <p>
                    {
                      circuit.expectedResult
                    }
                  </p>
                </div>

                {circuit.notes && (
                  <div className="fixture-location-note">
                    <span>
                      Circuit notes
                    </span>

                    <p>
                      {circuit.notes}
                    </p>
                  </div>
                )}
              </article>
            ),
          )}
        </div>
      </section>
    </>
  );
}