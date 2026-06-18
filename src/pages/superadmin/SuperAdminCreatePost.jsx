import { useState, useEffect } from 'react';
import ChipSelect from '../../components/ChipSelect.jsx';
import { useToast } from '../../components/Toast.jsx';
import { createPost, updatePost, getBranches } from '../../services/firestore.js';
import { CLASSES } from '../../constants/classes.js';

const CATEGORIES = ['Announcement', 'Event', 'Fee', 'Emergency', 'Holiday'];

const SCOPE_OPTIONS = [
  { value: 'all_branches', label: '🌐 All Branches' },
  { value: 'branch', label: '🏫 Specific Branch' },
  { value: 'class', label: '🎓 Specific Class' },
];

/**
 * SuperAdminCreatePost
 * 3-level targeting: All Branches / Specific Branch / Specific Class.
 * 5 categories, image upload, push notification toggle.
 * "Schedule Later" stores scheduledFor timestamp + status='scheduled' — visual only.
 *
 * When postToEdit is provided, the form operates in EDIT mode:
 *  - Heading changes to "Edit Network Post"
 *  - Submit button reads "Save Changes"
 *  - Calls updatePost() instead of createPost()
 *  - Notifications/scheduling options are hidden (no new notifications on edit)
 */
export default function SuperAdminCreatePost({ onCreated, pop, postToEdit }) {
  const toast = useToast();
  const isEditing = !!postToEdit;
  const [branches, setBranches] = useState([]);

  // Map stored scope ('all') back to form scope ('all_branches') for editing
  function mapScopeToForm(scope) {
    if (!scope || scope === 'all' || scope === 'global') return 'all_branches';
    return scope; // 'branch' | 'class'
  }

  const [form, setForm] = useState({
    title: isEditing ? (postToEdit.title || '') : '',
    body: isEditing ? (postToEdit.body || '') : '',
    category: isEditing ? (postToEdit.category || 'Announcement') : 'Announcement',
    scope: isEditing ? mapScopeToForm(postToEdit.scope) : 'all_branches',
    branchId: isEditing ? (postToEdit.branchId || '') : '',
    classId: isEditing ? (postToEdit.classId || postToEdit.className || '') : '',
    pushNotification: true,
    scheduleLater: false,
    scheduledFor: '',
  });

  // Existing images from Firestore (shown as removable thumbnails)
  const [existingImageUrls, setExistingImageUrls] = useState(
    isEditing ? (postToEdit.imageUrls || []) : []
  );
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getBranches().then(setBranches).catch(console.warn);
  }, []);

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    setImages(files.slice(0, 5));
  };

  const handleRemoveExistingImage = (url) => {
    setExistingImageUrls(prev => prev.filter(u => u !== url));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.body.trim()) { toast.error('Message body is required'); return; }
    if (form.scope === 'branch' && !form.branchId) { toast.error('Select a branch'); return; }
    if (form.scope === 'class' && !form.classId) { toast.error('Select a class'); return; }
    if (form.scope === 'class' && !form.branchId) { toast.error('Select a branch for this class'); return; }
    if (!isEditing && form.scheduleLater && !form.scheduledFor) { toast.error('Set a schedule date/time'); return; }

    setLoading(true);
    try {
      if (isEditing) {
        await updatePost(postToEdit.id, {
          title: form.title.trim(),
          body: form.body.trim(),
          category: form.category,
          scope: form.scope,
          branchId: form.scope !== 'all_branches' ? form.branchId : null,
          classId: form.scope === 'class' ? form.classId : null,
          existingImageUrls,
          images: images.length ? images : [],
        });
        toast.success('Post updated successfully!');
      } else {
        const scope = form.scope === 'all_branches' ? 'all' : form.scope;
        await createPost({
          title: form.title.trim(),
          body: form.body.trim(),
          category: form.category,
          scope,
          branchId: form.scope !== 'all_branches' ? form.branchId : null,
          classId: form.scope === 'class' ? form.classId : null,
          pushNotification: form.pushNotification,
          scheduledFor: form.scheduleLater && form.scheduledFor ? form.scheduledFor : null,
          status: form.scheduleLater ? 'scheduled' : 'published',
          images: images.length ? images : [],
        });
        toast.success(form.scheduleLater ? 'Post scheduled!' : 'Post published!');
      }
      onCreated?.();
      pop?.();
    } catch (err) {
      console.error('Post submit error:', err);
      toast.error(isEditing ? 'Failed to update post' : 'Failed to publish post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay-panel open">
      <div className="overlay-panel-header">
        <button className="overlay-panel-back" onClick={pop}>←</button>
        <h2>{isEditing ? 'Edit Network Post' : 'Create Network Post'}</h2>
      </div>
      <div className="overlay-panel-content" style={{ padding: 16 }}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-12">

          {/* Target Audience */}
          <div className="input-group">
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-hint)', marginBottom: 8 }}>
              Target Audience
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SCOPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, scope: opt.value, branchId: '', classId: '' }))}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 10,
                    border: `2px solid ${form.scope === opt.value ? 'var(--primary)' : 'rgba(26,35,64,0.12)'}`,
                    background: form.scope === opt.value ? 'var(--accent-light)' : 'white',
                    color: form.scope === opt.value ? 'var(--primary)' : 'var(--text-mid)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {form.scope === opt.value
                    ? <span style={{ marginRight: 8, fontSize: 14 }}>●</span>
                    : <span style={{ marginRight: 8, fontSize: 14, opacity: 0.3 }}>○</span>
                  }
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Branch selector */}
          {(form.scope === 'branch' || form.scope === 'class') && (
            <div className="input-group">
              <label>Branch</label>
              <select
                className="input"
                value={form.branchId}
                onChange={e => setForm(f => ({ ...f, branchId: e.target.value, classId: '' }))}
                required
              >
                <option value="">Select Branch...</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {/* Class selector */}
          {form.scope === 'class' && (
            <div className="input-group">
              <label>Class</label>
              <select
                className="input"
                value={form.classId}
                onChange={e => setForm(f => ({ ...f, classId: e.target.value }))}
                required
              >
                <option value="">Select Class...</option>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* Category */}
          <div className="input-group">
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-hint)', marginBottom: 8 }}>
              Category
            </label>
            <ChipSelect
              options={CATEGORIES}
              value={form.category}
              onChange={val => setForm(f => ({ ...f, category: val }))}
            />
          </div>

          {/* Title */}
          <div className="input-group">
            <label>Title</label>
            <input
              className="input"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Post title"
              required
            />
          </div>

          {/* Body */}
          <div className="input-group">
            <label>Message / Description</label>
            <textarea
              className="input"
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder="Write your announcement..."
              style={{ minHeight: 120, fontFamily: 'inherit' }}
              required
            />
          </div>

          {/* Image upload */}
          <div className="input-group">
            <label>Media / Images (optional, max 5)</label>

            {/* Existing images when editing */}
            {isEditing && existingImageUrls.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                {existingImageUrls.map((url, i) => (
                  <div key={i} style={{ position: 'relative', width: 64, height: 64 }}>
                    <img
                      src={url}
                      alt=""
                      style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #E2E8F0' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveExistingImage(url)}
                      style={{
                        position: 'absolute', top: -6, right: -6,
                        width: 18, height: 18, borderRadius: '50%',
                        background: 'var(--error)', color: 'white',
                        border: 'none', cursor: 'pointer', fontSize: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, lineHeight: 1,
                      }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="input"
              style={{ padding: '8px' }}
            />
            {images.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {images.map((f, i) => (
                  <div key={i} style={{
                    fontSize: 11, color: 'var(--text-hint)',
                    background: '#F1F5F9', padding: '4px 10px', borderRadius: 6,
                  }}>
                    📎 {f.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Push Notification and Schedule — hidden when editing */}
          {!isEditing && (
            <>
              {/* Push Notification toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dark)' }}>🔔 Send Push Notification</div>
                  <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>Notify parents when published</div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, pushNotification: !f.pushNotification }))}
                  style={{
                    width: 44, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer',
                    background: form.pushNotification ? 'var(--primary)' : '#CBD5E1',
                    position: 'relative', transition: 'background 0.2s ease', flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3, left: form.pushNotification ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                  }} />
                </button>
              </div>

              {/* Schedule Later toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dark)' }}>🕐 Schedule Later</div>
                  <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>Show as scheduled — saved but not auto-sent</div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, scheduleLater: !f.scheduleLater, scheduledFor: '' }))}
                  style={{
                    width: 44, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer',
                    background: form.scheduleLater ? 'var(--primary)' : '#CBD5E1',
                    position: 'relative', transition: 'background 0.2s ease', flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3, left: form.scheduleLater ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                  }} />
                </button>
              </div>

              {form.scheduleLater && (
                <div className="input-group">
                  <label>Schedule Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={form.scheduledFor}
                    onChange={e => setForm(f => ({ ...f, scheduledFor: e.target.value }))}
                    required={form.scheduleLater}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              )}
            </>
          )}

          {isEditing && (
            <div style={{ padding: '10px 14px', background: '#FFF7ED', borderRadius: 10, border: '1px solid #FED7AA', fontSize: 12, color: '#92400E' }}>
              ⏱️ Editing is only available within 30 minutes of post creation. Notifications will not be resent.
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4 }}>
            {loading
              ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
              : isEditing
                ? '💾 Save Changes'
                : form.scheduleLater ? '🕐 Save Scheduled Post' : '📢 Publish to Network'
            }
          </button>
        </form>
      </div>
    </div>
  );
}
