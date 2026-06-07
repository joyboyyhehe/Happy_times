import { useState, useCallback } from 'react';
import { useToast } from '../components/Toast.jsx';
import { getPosts, createPost, deletePost } from '../services/firestore.js';
import { auth } from '../config/firebase.js';

export function usePosts() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState([]);
  const [lastPostDoc, setLastPostDoc] = useState(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);

  /** Load first page of posts for a given branch (or null = all branches for SA) */
  const loadPosts = useCallback(async (branchId) => {
    setLoading(true);
    try {
      const { items, lastDoc } = await getPosts({ branchId: branchId || null, limitCount: 20 });
      setPosts(items);
      setLastPostDoc(lastDoc);
      setHasMorePosts(items.length === 20);
    } catch (e) {
      console.error('Failed to load posts:', e);
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadMorePosts = useCallback(async (branchId) => {
    if (!lastPostDoc || loading) return;
    setLoading(true);
    try {
      const { items, lastDoc } = await getPosts({ branchId: branchId || null, limitCount: 20, lastVisible: lastPostDoc });
      setPosts(prev => [...prev, ...items]);
      setLastPostDoc(lastDoc);
      setHasMorePosts(items.length === 20);
    } catch (e) {
      console.error('Failed to load more posts:', e);
      toast.error('Failed to load more posts');
    } finally {
      setLoading(false);
    }
  }, [lastPostDoc, loading, toast]);

  /**
   * handleDeletePost — role-aware deletion.
   * @param {string} postId
   * @param {string} role        — 'superadmin' | 'branchadmin'
   * @param {string} branchId    — current admin's branchId (for branchadmin)
   */
  const handleDeletePost = useCallback(async (postId, role, branchId) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    // Branch admin: can only delete their own posts within their branch
    if (role === 'branchadmin') {
      const currentUid = auth.currentUser?.uid;
      if (post.authorUid !== currentUid || post.branchId !== branchId) {
        toast.error('You can only delete posts you created for your branch');
        return;
      }
    }
    // Super admin: can delete any post

    try {
      await deletePost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
      toast.success('Post deleted');
    } catch (e) {
      console.error('Delete post error:', e);
      toast.error('Failed to delete post');
    }
  }, [posts, toast]);

  const handleCreatePost = useCallback(async (postForm, branchId) => {
    if (!postForm.title?.trim()) {
      toast.error('Title required');
      return false;
    }
    setLoading(true);
    try {
      await createPost({
        ...postForm,
        branchId,
        classId: postForm.scope === 'class' ? postForm.classId : null,
      });
      toast.success('Post published!');
      return true;
    } catch (e) {
      console.error('Failed to create post:', e);
      toast.error('Failed to create post');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    loading,
    posts,
    hasMorePosts,
    loadPosts,
    loadMorePosts,
    handleCreatePost,
    handleDeletePost,
  };
}
