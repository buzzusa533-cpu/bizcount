/**
 * BizCount — Tasks Function
 * GET  /api/tasks
 * POST /api/tasks { action: 'add'|'update-status'|'delete' }
 */

const { getDb, ok, err, verifyToken, CORS_HEADERS } = require('./_firebase');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };

  const decoded = verifyToken(event);
  if (!decoded) return err('Unauthorized.', 401);

  const db      = getDb();
  const ownerId = decoded.role === 'owner' ? decoded.uid : decoded.owner_id;

  // GET tasks
  if (event.httpMethod === 'GET') {
    let snap;
    if (decoded.role === 'owner') {
      snap = await db.collection('tasks').where('owner_id', '==', decoded.uid).orderBy('created_at', 'desc').get();
    } else {
      snap = await db.collection('tasks').where('staff_id', '==', decoded.uid).orderBy('created_at', 'desc').get();
    }

    // Attach staff names for owner view
    let tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (decoded.role === 'owner') {
      const staffSnap = await db.collection('users').where('owner_id', '==', decoded.uid).where('role', '==', 'staff').get();
      const staffMap  = {};
      staffSnap.docs.forEach(d => { staffMap[d.id] = d.data().first_name + ' ' + d.data().last_name; });
      tasks = tasks.map(t => ({ ...t, staff_name: staffMap[t.staff_id] || '—' }));
    }

    return ok({ tasks });
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}
  const action = body.action || '';

  // ADD task (owner only)
  if (action === 'add') {
    if (decoded.role !== 'owner') return err('Only owners can assign tasks.', 403);
    const { staff_id, title, description, priority, due_date } = body;
    if (!staff_id || !title) return err('Staff member and task title are required.');
    const now = new Date().toISOString();
    const ref = await db.collection('tasks').add({
      owner_id: decoded.uid, staff_id,
      title: title.trim(),
      description: description || '',
      priority: priority || 'normal',
      status: 'pending',
      due_date: due_date || null,
      created_at: now, updated_at: now,
    });
    return ok({ id: ref.id, message: 'Task assigned.' });
  }

  // UPDATE STATUS (staff or owner)
  if (action === 'update-status') {
    const { id, status } = body;
    if (!id || !status) return err('Task ID and status required.');
    const validStatuses = ['pending', 'in_progress', 'done', 'cancelled'];
    if (!validStatuses.includes(status)) return err('Invalid status.');
    const snap = await db.collection('tasks').doc(id).get();
    if (!snap.exists) return err('Task not found.');
    // Staff can only update their own tasks; owners can update any
    if (decoded.role === 'staff' && snap.data().staff_id !== decoded.uid) return err('Permission denied.', 403);
    await snap.ref.update({ status, updated_at: new Date().toISOString() });
    return ok({ message: 'Task updated.' });
  }

  // DELETE (owner only)
  if (action === 'delete') {
    if (decoded.role !== 'owner') return err('Only owners can delete tasks.', 403);
    const { id } = body;
    if (!id) return err('Task ID required.');
    await db.collection('tasks').doc(id).delete();
    return ok({ message: 'Task deleted.' });
  }

  return err('Invalid action.');
};
