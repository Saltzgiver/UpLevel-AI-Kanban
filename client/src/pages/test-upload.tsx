import { TestUpload } from "@/components/ui/test-upload";

export default function TestUploadPage() {
  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-6 text-center">File Upload Test Page</h1>
      <p className="text-center mb-6 text-gray-500">
        This page tests basic file upload functionality isolated from the rest of the application.
      </p>
      <TestUpload />
    </div>
  );
}