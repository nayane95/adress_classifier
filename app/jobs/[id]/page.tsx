
import JobDetailsClient from './job-details-client';

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobDetailsClient jobId={id} />;
}
