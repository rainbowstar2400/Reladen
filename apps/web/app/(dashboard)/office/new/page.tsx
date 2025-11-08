'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResidentForm } from '@/components/forms/resident-form';
import { useRouter } from 'next/navigation';

export default function NewResidentPage() {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle>住人を追加</CardTitle>
      </CardHeader>
      <CardContent>
        <ResidentForm onSubmitted={() => router.push('/office/residents')} />
      </CardContent>
    </Card>
  );
}
