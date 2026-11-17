/** Preserve the existing task reader and its identity/replay protection.
 * Call ONLY after the current request generation + original task/CDK match succeeds.
 * Never construct invoice URLs from a task id, email, Session, CDK or config.
 */
export type TaskBillingObservation = Readonly<{
  task_id: string
  receipt_url?: string
  invoice_pdf_url?: string
  billing_portal_url?: string
  invoice_status?: string
  invoice_expires_at?: string
}>
export function pickTaskBilling(value: unknown, expectedTaskId: string): TaskBillingObservation | null {
  if (!value || typeof value !== 'object' || !expectedTaskId) return null
  const input=value as Record<string,unknown>
  if (input.task_id !== expectedTaskId) return null
  const result: Record<string,string>={task_id:expectedTaskId}
  for (const key of ['receipt_url','invoice_pdf_url','billing_portal_url','invoice_status','invoice_expires_at']) {
    const field=input[key]
    if (typeof field==='string' && field.length<=4096) result[key]=field
  }
  return Object.freeze(result) as TaskBillingObservation
}
