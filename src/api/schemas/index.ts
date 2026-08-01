/**
 * Request contracts.
 *
 * Every schema is shared by the browser form that submits it and the route
 * handler that receives it, so client-side validation can never drift from what
 * the server enforces.
 */

export * from '@/api/schemas/archives.schema';
export * from '@/api/schemas/common';
export * from '@/api/schemas/contact.schema';
export * from '@/api/schemas/documents.schema';
export * from '@/api/schemas/job.schema';
export * from '@/api/schemas/upload.schema';
