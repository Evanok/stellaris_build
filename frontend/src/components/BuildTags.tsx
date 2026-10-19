import React from 'react';
import { Modal } from 'react-bootstrap';
import {
  BUILD_TAGS,
  BUILD_TAG_GROUPS,
  MAX_TAGS_PER_BUILD,
  BuildTag,
  getConflictingTag,
  parseBuildTags,
} from '../utils/buildTags';

const TAG_BADGE_STYLE: React.CSSProperties = {
  backgroundColor: 'rgba(13, 110, 253, 0.25)',
  border: '1px solid rgba(13, 110, 253, 0.6)',
  cursor: 'help',
};

// Read-only list of tag badges; the description is shown as a tooltip
export const BuildTagList: React.FC<{ tags: string | null | undefined; large?: boolean }> = ({ tags, large }) => {
  const parsed = parseBuildTags(tags);
  if (parsed.length === 0) return null;

  return (
    <div className="d-flex flex-wrap gap-1">
      {parsed.map(tag => (
        <span
          key={tag.id}
          className={`badge text-white${large ? ' fs-6 px-3 py-2' : ''}`}
          style={TAG_BADGE_STYLE}
          title={tag.description}
        >
          {tag.label}
        </span>
      ))}
    </div>
  );
};

// Groups the tags in their display order, skipping empty groups
const groupedTags = (): { label: string; tags: BuildTag[] }[] =>
  BUILD_TAG_GROUPS
    .map(group => ({ label: group.label, tags: BUILD_TAGS.filter(tag => tag.group === group.id) }))
    .filter(group => group.tags.length > 0);

// Explains every tag; opened from the home page filter bar
export const BuildTagsHelpModal: React.FC<{ show: boolean; onHide: () => void }> = ({ show, onHide }) => (
  <Modal show={show} onHide={onHide} centered scrollable>
    <Modal.Header closeButton className="bg-dark text-white border-secondary">
      <Modal.Title>
        <i className="bi bi-tags me-2"></i>
        What do the tags mean?
      </Modal.Title>
    </Modal.Header>
    <Modal.Body className="bg-dark text-white">
      <p className="text-white-50 small">
        Tags are chosen by the build author (up to {MAX_TAGS_PER_BUILD} per build). They describe how the
        build plays - how hard it is to play is covered separately by the Difficulty rating.
      </p>
      {groupedTags().map(group => (
        <div key={group.label} className="mb-3">
          <h6 className="text-uppercase text-white-50 small mb-2">{group.label}</h6>
          <dl className="mb-0">
            {group.tags.map(tag => (
              <div key={tag.id} className="mb-2">
                <dt className="d-inline">
                  <span className="badge text-white me-2" style={TAG_BADGE_STYLE}>{tag.label}</span>
                </dt>
                <dd className="d-inline mb-0 small">{tag.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </Modal.Body>
  </Modal>
);

interface BuildTagPickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
}

// Checkbox list used in the build form. Each option shows its description inline (tooltips do not
// work on mobile), and options are disabled when the limit is reached or they conflict with a pick.
export const BuildTagPicker: React.FC<BuildTagPickerProps> = ({ selected, onChange }) => {
  const limitReached = selected.length >= MAX_TAGS_PER_BUILD;

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  return (
    <div>
      {groupedTags().map(group => (
        <div key={group.label} className="mb-3">
          <h6 className="text-uppercase text-white-50 small mb-2">{group.label}</h6>
          <div className="row g-2">
            {group.tags.map(tag => {
              const isSelected = selected.includes(tag.id);
              const conflict = isSelected ? undefined : getConflictingTag(tag.id, selected);
              const disabled = !isSelected && (limitReached || !!conflict);
              return (
                <div key={tag.id} className="col-md-6">
                  <label
                    className={`d-flex gap-2 p-2 rounded border h-100 ${isSelected ? 'border-primary' : 'border-secondary'}`}
                    style={{
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.5 : 1,
                      backgroundColor: isSelected ? 'rgba(13, 110, 253, 0.15)' : 'transparent',
                    }}
                    title={conflict ? `Cannot be combined with "${conflict.label}"` : undefined}
                  >
                    <input
                      type="checkbox"
                      className="form-check-input mt-1 flex-shrink-0"
                      checked={isSelected}
                      disabled={disabled}
                      onChange={() => toggle(tag.id)}
                    />
                    <span>
                      <span className="fw-semibold text-white d-block">{tag.label}</span>
                      <small className="text-white-50">
                        {conflict ? `Cannot be combined with "${conflict.label}".` : tag.description}
                      </small>
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
