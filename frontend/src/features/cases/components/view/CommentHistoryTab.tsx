import React, { useEffect, useState } from 'react';
import { commentService } from '../../services/commentService';
import type { CommentsByCaseId } from '../../services/commentService';

interface CommentsHistoryTabProps {
  caseId: string;
}

const CommentsHistoryTab: React.FC<CommentsHistoryTabProps> = ({ caseId }) => {
  const [tasks, setTasks] = useState<CommentsByCaseId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTasks() {
      try {
        const data = await commentService.getCommentsByCaseId(caseId);
        setTasks(data);
      } catch (error) {
        console.error('Failed to load comments', error);
      } finally {
        setLoading(false);
      }
    }

    loadTasks();
  }, [caseId]);

  const SectionCard: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      {title ? <div className="mb-2 text-sm font-semibold text-gray-700">{title}</div> : null}
      <div className="text-sm text-gray-900">{children}</div>
    </div>
  );

  if (loading) return <div>Loading...</div>;

  if (!tasks.length) return <div className="text-center py-8">
    <div className="text-sm text-gray-500">
      No comments found for this case.
    </div>
  </div>;

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-gray-700">Comments History</div>

      {tasks.map((c) => (
        <div key={c.comment_id} className="space-y-3">
          <SectionCard>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">

              {/* Comment ID */}
              <div>
                <div className="text-xs text-gray-500 uppercase">Comment ID</div>
                <div className="font-medium text-gray-900 break-all">
                  {c.comment_id}
                </div>
              </div>

              {/* User ID */}
              <div>
                <div className="text-xs text-gray-500 uppercase">User ID</div>
                <div className="font-medium text-gray-900 break-all">
                  {c.user_id}
                </div>
              </div>

              {/* Note*/}
              <div className="col-span-2">
                <div className="text-xs text-gray-500 uppercase">Note</div>
                <div className="font-medium text-gray-900 mt-1 whitespace-pre-line">
                  {c.note}
                </div>
              </div>

              {/* Created At */}
              <div>
                <div className="text-xs text-gray-500 uppercase">Created At</div>
                <div className="font-medium text-gray-900">
                  {new Date(c.created_at).toLocaleString()}
                </div>
              </div>

              {/* Updated At */}
              <div>
                <div className="text-xs text-gray-500 uppercase">Updated At</div>
                <div className="font-medium text-gray-900">
                  {new Date(c.updated_at).toLocaleString()}
                </div>
              </div>

            </div>
          </SectionCard>
        </div>
      ))}
    </div>





  );
};

export default CommentsHistoryTab;
