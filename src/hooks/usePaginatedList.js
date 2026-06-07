import { useState, useCallback, useRef } from 'react';

/**
 * usePaginatedList — Cursor-based pagination hook for Firestore lists.
 * Prevents loading all items at once (performance rule).
 *
 * @param {function} fetchFn - Async function(lastDoc?) => { items: [], lastDoc: null|doc }
 * @param {number} [pageSize] - Items per page (default 25)
 *
 * Usage:
 *   const { items, loading, hasMore, loadMore, reload } = usePaginatedList(
 *     (lastDoc) => getLogs({ branchId, limitCount: 25, lastVisible: lastDoc }),
 *     25
 *   );
 */
export function usePaginatedList(fetchFn, pageSize = 25) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef(null);

  const loadMore = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await fetchFn(lastDocRef.current);
      const newItems = result.items || [];
      lastDocRef.current = result.lastDoc || null;
      setHasMore(newItems.length >= pageSize);
      setItems((prev) => [...prev, ...newItems]);
    } catch (err) {
      console.error('usePaginatedList loadMore error:', err);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [fetchFn, loading, pageSize]);

  const reload = useCallback(async () => {
    lastDocRef.current = null;
    setItems([]);
    setHasMore(true);
    setLoading(true);
    try {
      const result = await fetchFn(null);
      const newItems = result.items || [];
      lastDocRef.current = result.lastDoc || null;
      setHasMore(newItems.length >= pageSize);
      setItems(newItems);
    } catch (err) {
      console.error('usePaginatedList reload error:', err);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [fetchFn, pageSize]);

  return { items, loading, hasMore, loadMore, reload };
}
