import { useState } from 'react';
import ChipSelect from '../../components/ChipSelect.jsx';
import { useToast } from '../../components/Toast.jsx';
import { createPost } from '../../services/firestore.js';
import { CLASSES } from '../../constants/classes.js';

const CATEGORIES = ['Announcement', 'Event', 'Holiday', 'Circular', 'General'];

/**
 * BranchAdminCreatePost
 * Scope: "Entire Branch" or "Specific Class" — no all-branches option.
 * The branchId is always the admin's own branch.
 */
export default function BranchAdminCreatePost({ branchId, onCreated, pop }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: '',
    body: '',
    category: 'General',
    scope: 'branch',   // 'branch' | 'class'
    classId: '',
    pushNotification: true,
  });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    setImages(files.slice(0, 3)); // max 3 images
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.body.trim()) { toast.error('Message body is required'); return; }
    if (form.scope === 'class' && !form.classId) { toast.error('Select a class first'); return; }

    setLoading(true);
    try {
      await createPost({
        title: form.title.trim(),
        body: form.body.trim(),
        category: form.category,
        scope: form.scope,
        branchId,
        classId: form.scope === 'class' ? form.classId : null,
        pushNotification: form.pushNotification,
        images: images.length ? images : [],
      });
      toast.success('Post published!');
      onCreated?.();
      pop?.();
    } catch (err) {
      console.error('Create post error:', err);
      toast.error('Failed to publish post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay-panel open">
      <div className="overlay-panel-header">
        <button className="overlay-panel-back" onClick={pop}>←</button>
        <h2>Create Post</h2>
      </div>
      <div className="overlay-panel-content" style={{ padding: 16 }}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-12">

          {/* Target: radio-style scope */}
          <div className="input-group">
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-hint)', marginBottom: 8 }}>
              Target Audience
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { value: 'branch', label: '🏫 Entire Branch' },
                { value: 'class', label: '🎓 Specific Class' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, scope: opt.value, classId: '' }))}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    borderRadius: 10,
                    border: `2px solid ${form.scope === opt.value ? 'var(--primary)' : 'rgba(26,35,64,0.12)'}`,
                    background: form.scope === opt.value ? 'var(--accent-light)' : 'white',
                    color: form.scope === opt.value ? 'var(--primary)' : 'var(--text-mid)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Class selector (only when scope = 'class') */}
          {form.scope === 'class' && (
            <div className="input-group">
              <label>Select Class</label>
              <select
                className="input"
                value={form.classId}
                onChange={e => setForm(f => ({ ...f, classId: e.target.value }))}
                required
              >
                <option value="">Choose a class...</option>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

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
            <label>Message</label>
            <textarea
              className="input"
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder="Write your announcement..."
              style={{ minHeight: 120, fontFamily: 'inherit' }}
              required
            />
          </div>

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

          {/* Image upload */}
          <div className="input-group">
            <label>Images (optional, max 3)</label>
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

          {/* Push notification toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dark)' }}>🔔 Send Push Notification</div>
              <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>Notify parents when this post is published</div>
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

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} /> : '📢 Publish Post'}
          </button>
        </form>
      </div>
    </div>
  );
}
