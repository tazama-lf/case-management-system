import React, { useEffect, useState } from 'react';
import { commentService } from '../../services/commentService';
import type { CommentsByCaseId } from '../../services/commentService';
import { useInvestigatorSupervisorList } from '../../../cases/hooks/useInvestigatorSupervisorList';
import { formatDate } from '@/shared/utils/dateUtils';

interface CommentsHistoryTabProps {
  caseId: number;
}

const CommentsHistoryTab: React.FC<CommentsHistoryTabProps> = ({ caseId }) => {
  const [tasks, setTasks] = useState<CommentsByCaseId[]>([]);
  const [loading, setLoading] = useState(true);
  const {
    fetchInvestigatorsList,
    investigators,
    supervisors,
    fetchSupervisorsList,
  } = useInvestigatorSupervisorList();

  useEffect(() => {
    if (investigators.length === 0) {
      fetchInvestigatorsList();
    }
    if (supervisors.length === 0) {
      fetchSupervisorsList();
    }
  }, []);

  const getUserNameById = (userId: string) => {
    const inv = investigators.find((i) => i.id === userId);
    if (inv) return `${inv.firstName} ${inv.lastName}`;

    const sup = supervisors.find((i) => i.id === userId);
    if (sup) return `${sup.firstName} ${sup.lastName}`;

    return userId;
  };

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

  const SectionCard: React.FC<{
    title?: string;
    children: React.ReactNode;
  }> = ({ title, children }) => (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      {title ? (
        <div className="mb-2 text-sm font-semibold text-gray-700">{title}</div>
      ) : null}
      <div className="text-sm text-gray-900">{children}</div>
    </div>
  );

  if (loading) return <div>Loading...</div>;

  if (!tasks.length) {
    return (
      <div className="text-center py-8">
        <div className="text-sm text-gray-500">
          No comments found for this case.
        </div>
      </div>
    );
  }

  const caseComments = tasks.filter((c) => !c.task_id);
  const taskComments = tasks.filter((c) => c.task_id);

  return (
    <div className="space-y-6">
      {/* Tasks Based Comments */}
      <div className="text-sm font-semibold text-gray-700">Tasks Comments</div>

      {taskComments.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-sm text-gray-500">No tasks comments found.</div>
        </div>
      ) : (
        taskComments.map((c) => (
          <SectionCard key={c.comment_id}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {/* Comment ID */}
              <div>
                <div className="text-xs text-gray-500 uppercase">
                  Comment ID
                </div>
                <div className="font-medium text-gray-900 break-all">
                  {c.comment_id}
                </div>
              </div>

              {/* User ID */}
              <div>
                <div className="text-xs text-gray-500 uppercase">User Name</div>
                <div className="font-medium text-gray-900 break-all">
                  {getUserNameById(c.user_id)}
                </div>
              </div>

              {/* Task ID */}
              <div className="col-span-2">
                <div className="text-xs text-gray-500 uppercase">Task ID</div>
                <div className="font-medium text-gray-900 mt-1 whitespace-pre-line">
                  {c.task_id}
                </div>
              </div>

              {/* Note */}
              <div className="col-span-2">
                <div className="text-xs text-gray-500 uppercase">Note</div>
                <div className="font-medium text-gray-900 mt-1 whitespace-pre-wrap break-words">
                  {c.note}
                </div>
              </div>

              {/* Created At */}
              <div>
                <div className="text-xs text-gray-500 uppercase">
                  Created At
                </div>
                <div className="font-medium text-gray-900">
                  {formatDate(c.created_at)}
                </div>
              </div>

              {/* Updated At */}
              <div>
                <div className="text-xs text-gray-500 uppercase">
                  Updated At
                </div>
                <div className="font-medium text-gray-900">
                  {formatDate(c.updated_at)}
                </div>
              </div>
            </div>
          </SectionCard>
        ))
      )}
      {/* <div className="text-sm font-semibold text-gray-700">Comments History</div> */}
      {/* Case Based Comments */}
      <div className="text-sm font-semibold text-gray-700">Case Comments</div>

      {caseComments.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-sm text-gray-500">No case comments found.</div>
        </div>
      ) : (
        caseComments.map((c) => (
          <SectionCard key={c.comment_id}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {/* Comment ID */}
              <div>
                <div className="text-xs text-gray-500 uppercase">
                  Comment ID
                </div>
                <div className="font-medium text-gray-900 break-all">
                  {c.comment_id}
                </div>
              </div>

              {/* User ID */}
              <div>
                <div className="text-xs text-gray-500 uppercase">User Name</div>
                <div className="font-medium text-gray-900 break-all">
                  {getUserNameById(c.user_id)}
                </div>
              </div>

              {/* Note */}
              <div className="col-span-2">
                <div className="text-xs text-gray-500 uppercase">Note</div>
                <div className="font-medium text-gray-900 mt-1 whitespace-pre-wrap break-words">
                  {c.note}
                </div>
              </div>

              {/* Created At */}
              <div>
                <div className="text-xs text-gray-500 uppercase">
                  Created At
                </div>
                <div className="font-medium text-gray-900">
                  {formatDate(c.created_at)}
                </div>
              </div>

              {/* Updated At */}
              <div>
                <div className="text-xs text-gray-500 uppercase">
                  Updated At
                </div>
                <div className="font-medium text-gray-900">
                  {formatDate(c.updated_at)}
                </div>
              </div>
            </div>
          </SectionCard>
        ))
      )}
    </div>
  );
};

export default CommentsHistoryTab;
