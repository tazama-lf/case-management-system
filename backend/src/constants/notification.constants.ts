export const EMAIL_TEMPLATES = {
  taskAssigned: (data: Record<string, any>): string => {
    const reason = data.reason ? `<li><strong>Reason:</strong> ${data.reason}</li>` : '';
    const extra = data.reassignedBy && `<li><strong>Reassigned By:</strong> ${data.reassignedBy}</li>`;

    return `
      <p>Hello,</p>
      <p>Task <strong>${data.taskTitle}</strong> (ID: ${data.taskId}) has been assigned.</p>
      <ul>${reason}${extra || ''}</ul>
      <p>Please check the Case Management System tFo take action.</p>
      <p>Regards,<br/>CMS Team</p>
    `;
  },

  taskUnassigned: (data: Record<string, any>): string => {
    const reason = data.reason ? `<li><strong>Reason:</strong> ${data.reason}</li>` : '';

    return `
      <p>Hello,</p>
      <p>Task <strong>${data.taskTitle}</strong> (ID: ${data.taskId}) has been unassigned.</p>
      <ul>${reason}</ul>
      <p>Please check the Case Management System to take action.</p>
      <p>Regards,<br/>CMS Team</p>
    `;
  },

  taskReassigned: (data: Record<string, any>): string => {
    const reason = data.reason ? `<li><strong>Reason:</strong> ${data.reason}</li>` : '';
    const extra = data.reassignedBy && `<li><strong>Reassigned By:</strong> ${data.reassignedBy}</li>`;

    return `
      <p>Hello,</p>
      <p>Task <strong>${data.taskTitle}</strong> (ID: ${data.taskId}) has been reassigned.</p>
      <ul>${reason}${extra || ''}</ul>
      <p>Please check the Case Management System to take action.</p>
      <p>Regards,<br/>CMS Team</p>
    `;
  },

  workQueue: (data: Record<string, any>): string => `
    <p>Hello,</p>
    <p>A new task is available in the <strong>${data.candidateGroup}</strong> work queue:</p>
    <ul>
      <li><strong>Task:</strong> ${data.taskTitle}</li>
      <li><strong>Task ID:</strong> ${data.taskId}</li>
    </ul>
    <p>Please check the Case Management System to claim this task.</p>
    <p>Regards,<br/>CMS Team</p>
  `,

  caseSuspended: (data: Record<string, any>): string => `
    <p>Hello,</p>
    <p>Your case <strong>${data.caseId}</strong> has been suspended.</p>
    <ul>
      <li><strong>Suspended By:</strong> ${data.actionBy}</li>
      <li><strong>Reason:</strong> ${data.reason}</li>
    </ul>
    <p>The case is now on hold.</p>
    <p>Regards,<br/>CMS Team</p>
  `,

  caseResumed: (data: Record<string, any>): string => `
    <p>Hello,</p>
    <p>Your case <strong>${data.caseId}</strong> has been resumed.</p>
    <ul>
      <li><strong>Resumed By:</strong> ${data.actionBy}</li>
      <li><strong>Reason:</strong> ${data.reason}</li>
    </ul>
    <p>The case is now active again.</p>
    <p>Regards,<br/>CMS Team</p>
  `,

  caseClosurePending: (data: Record<string, any>): string => `
    <p>Hello Supervisor,</p>
    <p>Case <strong>${data.caseId}</strong> has been submitted for closure approval.</p>
    <ul>
      <li><strong>Recommended Outcome:</strong> ${data.recommendedOutcome}</li>
      <li><strong>Submitted By:</strong> ${data.submittedBy}</li>
      <li><strong>Approval Task ID:</strong> ${data.approvalTaskId}</li>
    </ul>
    <p>Please review and approve or reject the case closure.</p>
    <p>Regards,<br/>CMS Team</p>
  `,

  caseClosureApproved: (data: Record<string, any>): string => `
    <p>Hello,</p>
    <p>Your case closure for case <strong>${data.caseId}</strong> has been approved.</p>
    <ul>
      <li><strong>Final Outcome:</strong> ${data.finalOutcome}</li>
      <li><strong>Approved By:</strong> ${data.approvedBy}</li>
      ${data.supervisorComments ? `<li><strong>Comments:</strong> ${data.supervisorComments}</li>` : ''}
    </ul>
    <p>The case has been successfully closed.</p>
    <p>Regards,<br/>CMS Team</p>
  `,

  caseClosureRejected: (data: Record<string, any>): string => `
    <p>Hello,</p>
    <p>Your case closure request for case <strong>${data.caseId}</strong> has been rejected.</p>
    <h3>Supervisor Feedback:</h3>
    <blockquote style="border-left: 3px solid #dc3545; padding-left: 15px; color: #555;">
      ${data.supervisorComments}
    </blockquote>
    <h3>Next Steps:</h3>
    <ul>
      <li>A new "Investigate Case" task has been assigned to you (Task ID: ${data.taskId})</li>
      <li>Review the supervisor's feedback carefully</li>
      <li>Address the concerns raised</li>
      <li>Resubmit for closure approval when ready</li>
    </ul>
    <p>Rejected By: ${data.rejectedBy}</p>
    <p>Regards,<br/>CMS Team</p>
  `,

  caseReopened: (data: Record<string, any>): string => `
    <p>Hello,</p>
    <p>Case <strong>${data.caseId}</strong> has been reopened and assigned to you.</p>
    <ul>
      <li><strong>Task ID:</strong> ${data.taskId}</li>
      <li><strong>Approved By:</strong> ${data.approvedBy}</li>
      ${data.reason ? `<li><strong>Reason:</strong> ${data.reason}</li>` : ''}
    </ul>
    <p>Please review the case and conduct additional investigation as needed.</p>
    <p>Regards,<br/>CMS Team</p>
  `,

  caseReopenedAvailable: (data: Record<string, any>): string => `
    <p>Hello,</p>
    <p>Case <strong>${data.caseId}</strong> has been reopened and is now available in the investigations work queue.</p>
    <ul>
      <li><strong>Task ID:</strong> ${data.taskId}</li>
      <li><strong>Approved By:</strong> ${data.approvedBy}</li>
    </ul>
    <p>Please check the Case Management System to claim this case.</p>
    <p>Regards,<br/>CMS Team</p>
  `,

  caseReopeningRejected: (data: Record<string, any>): string => `
    <p>Hello,</p>
    <p>Your case reopening request for case <strong>${data.caseId}</strong> has been rejected.</p>
    <h3>Rejection Reason:</h3>
    <blockquote style="border-left: 3px solid #dc3545; padding-left: 15px; color: #555;">
      ${data.rejectionReason}
    </blockquote>
    <p>The case has been restored to its original status: <strong>${data.restoredStatus}</strong></p>
    <p>Rejected By: ${data.rejectedBy}</p>
    <p>Regards,<br/>CMS Team</p>
  `,

  slaWarning: (data: Record<string, any>): string => {
    const timeRemaining = data.timeUntilDeadline ? `${Math.abs(data.timeUntilDeadline)} minutes` : 'Unknown';

    return `
      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 10px 0;">
        <h2 style="color: #856404; margin-top: 0;">SLA Warning</h2>
        <p>A task in your work queue is approaching its SLA deadline and requires attention.</p>
        
        <h3 style="color: #333;">Task Details:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Task Name:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.taskName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Task ID:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.taskId}</td>
          </tr>
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Case ID:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.caseId}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Case Priority:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><span style="color: ${getPriorityColor(data.casePriority)};">${data.casePriority || 'NORMAL'}</span></td>
          </tr>
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Work Queue:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.workQueueName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Assigned To:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.assignedUserId || 'Unassigned'}</td>
          </tr>
          <tr style="background-color: #fff3cd;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Time Remaining:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong style="color: #856404;">${timeRemaining}</strong></td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>SLA Deadline:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.deadline || 'N/A'}</td>
          </tr>
        </table>
        
        <p style="margin-top: 20px;">Please prioritize this task to avoid an SLA breach.</p>
        <p>Regards,<br/>CMS Team</p>
      </div>
    `;
  },

  slaBreach: (data: Record<string, any>): string => {
    const breachDuration = data.breachDuration ? `${Math.abs(data.breachDuration)} minutes` : 'Unknown';

    const severityColor =
      {
        CRITICAL: '#dc3545',
        HIGH: '#fd7e14',
        MEDIUM: '#ffc107',
        LOW: '#6c757d',
        INFO: '#17a2b8',
      }[data.severity] || '#dc3545';

    return `
      <div style="background-color: #f8d7da; border-left: 4px solid ${severityColor}; padding: 20px; margin: 10px 0;">
        <h2 style="color: #721c24; margin-top: 0;">SLA BREACH ALERT</h2>
        <p style="color: #721c24; font-size: 16px;"><strong>A task has breached its SLA deadline and requires immediate action!</strong></p>
        
        <div style="background-color: ${severityColor}; color: white; padding: 10px; margin: 10px 0; text-align: center; border-radius: 5px;">
          <h3 style="margin: 0;">Severity: ${data.severity}</h3>
        </div>
        
        <h3 style="color: #333;">Task Details:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Task Name:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.taskName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Task ID:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.taskId}</td>
          </tr>
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Case ID:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.caseId}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Case Priority:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><span style="color: ${getPriorityColor(data.casePriority)};">${data.casePriority || 'NORMAL'}</span></td>
          </tr>
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Work Queue:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.workQueueName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Assigned To:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.assignedUserId || 'Unassigned'}</td>
          </tr>
          <tr style="background-color: #f8d7da;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Breach Duration:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong style="color: #721c24;">${breachDuration} OVERDUE</strong></td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>SLA Deadline Was:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.deadline || 'N/A'}</td>
          </tr>
        </table>
        
        <h3 style="color: #721c24; margin-top: 20px;">Required Actions:</h3>
        <ul style="color: #721c24;">
          <li>Escalate to supervisor immediately if not already assigned</li>
          <li>Prioritize completion of this task</li>
          <li>Document any reasons for the delay</li>
          <li>Update task status regularly</li>
        </ul>
        
        <p style="margin-top: 20px; color: #721c24;"><strong>This breach has been logged for reporting purposes.</strong></p>
        <p>Regards,<br/>CMS Team</p>
      </div>
    `;
  },

  taskOverdue: (data: Record<string, any>): string => {
    const hoursSinceCreation = data.hoursSinceCreation || 'Unknown';

    return `
      <div style="background-color: #e2e3e5; border-left: 4px solid #6c757d; padding: 20px; margin: 10px 0;">
        <h2 style="color: #383d41; margin-top: 0;">Overdue Task Alert</h2>
        <p>A task has been open for an extended period and may require attention or escalation.</p>
        
        <h3 style="color: #333;">Task Details:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Task Name:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.taskName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Task ID:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.taskId}</td>
          </tr>
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Case ID:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.caseId}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Case Priority:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><span style="color: ${getPriorityColor(data.casePriority)};">${data.casePriority || 'NORMAL'}</span></td>
          </tr>
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Work Queue:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.workQueueName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Assigned To:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.assignedUserId || 'Unassigned'}</td>
          </tr>
          <tr style="background-color: #e2e3e5;">
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Time Open:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong style="color: #383d41;">${hoursSinceCreation} hours</strong></td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><strong>Created At:</strong></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${data.createdAt || 'N/A'}</td>
          </tr>
        </table>
        
        <h3 style="color: #383d41; margin-top: 20px;">Recommended Actions:</h3>
        <ul>
          <li>Review task status and progress</li>
          <li>Check for any blockers or impediments</li>
          <li>Consider reassignment if necessary</li>
          <li>Update task priority if warranted</li>
          <li>Add comments documenting current status</li>
        </ul>
        
        <p style="margin-top: 20px;">Please review this task to ensure it receives appropriate attention.</p>
        <p>Regards,<br/>CMS Team</p>
      </div>
    `;
  },

  generic: (data: Record<string, any>): string => `<p>${data.message}</p>`,
};

/**
 * Helper function to get consistent priority colors
 */
export function getPriorityColor(priority?: string): string {
  switch (priority?.toUpperCase()) {
    case 'HIGH':
      return '#dc3545';
    case 'MEDIUM':
      return '#ffc107';
    case 'LOW':
    case 'NORMAL':
    default:
      return '#28a745';
  }
}
