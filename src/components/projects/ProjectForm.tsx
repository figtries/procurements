interface ProjectFormProps {
  name: string;
  client: string;
  location: string;
  pic: string;
  contractNo: string;
  handover: string;
  onChange: (field: string, value: string) => void;
  onSubmit: () => void;
}

export default function ProjectForm({
  name, client, location, pic, contractNo, handover,
  onChange, onSubmit,
}: ProjectFormProps) {
  return (
    <div className="proj-create-card">
      <div className="pcc-eyebrow">Procurement &amp; Vendor</div>
      <div className="pcc-title">Create a new project</div>

      <div className="pcc-fields">
        <div className="field">
          <label className="flabel">Project Name</label>
          <input
            type="text"
            className="finput"
            value={name}
            onChange={e => onChange('name', e.target.value)}
            placeholder="Example: Pulau Gading BCS Phase 1"
          />
        </div>

        <div className="field">
          <div className="field-row-3">
            <div>
              <label className="flabel">Client</label>
              <input
                type="text"
                className="finput"
                value={client}
                onChange={e => onChange('client', e.target.value)}
                placeholder="Company name"
              />
            </div>
            <div>
              <label className="flabel">Location</label>
              <input
                type="text"
                className="finput"
                value={location}
                onChange={e => onChange('location', e.target.value)}
                placeholder="City / Region"
              />
            </div>
            <div>
              <label className="flabel">Person in Charge</label>
              <input
                type="text"
                className="finput"
                value={pic}
                onChange={e => onChange('pic', e.target.value)}
                placeholder="Full Name"
              />
            </div>
          </div>
        </div>

        <div className="field">
          <div className="field-row">
            <div>
              <label className="flabel">Contract Number</label>
              <input
                type="text"
                className="finput"
                value={contractNo}
                onChange={e => onChange('contractNo', e.target.value)}
                placeholder="CTR-2024-XXXX"
              />
            </div>
            <div>
              <label className="flabel">Target Handover</label>
              <input
                type="date"
                className="finput"
                value={handover}
                onChange={e => onChange('handover', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <button className="btn-create" onClick={onSubmit}>Create Project</button>
    </div>
  );
}
