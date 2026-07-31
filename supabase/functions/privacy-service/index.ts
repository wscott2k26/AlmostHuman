import { createAppContext, safeError, statusOf } from '../_shared/context.ts';
import { serve } from '../_shared/cors.ts';

serve(async (req) => {
  try {
    const ctx = await createAppContext(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'export_all');

    if (action === 'export_all') {
      const { data, error } = await ctx.supabase.rpc('export_my_almost_human_data');
      if (error) throw error;
      await ctx.supabase.from('app_settings').update({ last_export_at: new Date().toISOString() }).eq('user_id', ctx.user.id);
      return Response.json(data);
    }

    if (action === 'delete_conversation') {
      const conversationId = String(body.conversation_id || '').trim();
      if (!conversationId) return Response.json({ error: 'conversation_id required' }, { status: 400 });
      const conversation = await ctx.entities.Conversation.get(conversationId);
      if (!conversation || conversation.created_by_id !== ctx.user.id) return Response.json({ error: 'Not found' }, { status: 404 });
      await ctx.entities.Conversation.delete(conversationId); // child rows cascade
      return Response.json({ status: 'deleted', conversation_id: conversationId });
    }

    if (action === 'archive_ai' || action === 'delete_ai') {
      const aiEntityId = String(body.ai_entity_id || '').trim();
      const ai = await ctx.entities.AIEntity.get(aiEntityId);
      if (!ai || ai.created_by_id !== ctx.user.id) return Response.json({ error: 'Not found' }, { status: 404 });
      if (String(body.confirm_name || '').trim().toLowerCase() !== String(ai.name || '').trim().toLowerCase()) {
        return Response.json({ error: 'Type the AI name exactly to confirm' }, { status: 400 });
      }
      if (action === 'archive_ai') {
        await ctx.entities.AIEntity.update(aiEntityId, { archived: true });
        return Response.json({ status: 'archived', ai_entity_id: aiEntityId });
      }
      await ctx.entities.AIEntity.delete(aiEntityId); // all life history cascades
      return Response.json({ status: 'deleted', ai_entity_id: aiEntityId });
    }

    if (action === 'delete_all_app_data' || action === 'delete_account') {
      const expected = action === 'delete_account' ? 'DELETE MY ACCOUNT' : 'DELETE MY ALMOST HUMAN DATA';
      if (String(body.confirm_phrase || '') !== expected) return Response.json({ error: 'Confirmation phrase does not match' }, { status: 400 });
      const secretAvailable = Boolean(Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
      if (action === 'delete_account' && !secretAvailable) {
        return Response.json({ error: 'Account deletion is not configured on the server.', code: 'MISSING_SECRET_KEY' }, { status: 503 });
      }
      const { error } = await ctx.supabase.rpc('delete_my_almost_human_data', { confirm_phrase: 'DELETE MY ALMOST HUMAN DATA' });
      if (error) throw error;
      if (action === 'delete_account') {
        const { error: deleteError } = await ctx.admin.auth.admin.deleteUser(ctx.user.id);
        if (deleteError) throw deleteError;
        return Response.json({ status: 'account_deleted' });
      }
      return Response.json({ status: 'app_data_deleted', auth_identity_retained: true });
    }

    return Response.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: statusOf(error) });
  }
});
