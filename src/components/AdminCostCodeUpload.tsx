import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CostCodeImport } from './CostCodeImport';
import { AlertCircle, CheckCircle, Database } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export const AdminCostCodeUpload: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState<{ total: number; success: number } | null>(null);
  const [replaceAll, setReplaceAll] = useState(false);

  const handleImport = async (codes: Array<{
    code: string;
    description: string;
    category: 'L' | 'M';
    subcategory?: string;
    units?: string;
  }>) => {
    setIsUploading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('upload-cost-codes', {
        body: { codes, replaceAll },
      });

      if (error) {
        throw error;
      }

      setUploadStats({ total: codes.length, success: data.inserted });
      
      toast({
        title: "Upload Complete",
        description: `Successfully uploaded ${data.inserted} cost codes to the database.`,
      });

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload cost codes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-full">
          <Database className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Admin: Cost Code Database</h2>
          <p className="text-muted-foreground">
            Upload your company's cost code library - available across all projects
          </p>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Admin Access Required:</strong> Only administrators can upload cost codes. 
          These codes will be available company-wide for all users and projects.
        </AlertDescription>
      </Alert>

      {uploadStats && (
        <Alert className="border-success bg-success/10">
          <CheckCircle className="h-4 w-4 text-success" />
          <AlertDescription>
            <strong>Upload Successful!</strong> {uploadStats.success} of {uploadStats.total} codes 
            were successfully added to the database.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upload Options</CardTitle>
          <CardDescription>
            Configure how the upload should handle existing data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="replace-all" className="text-base font-medium">
                Replace All Existing Codes
              </Label>
              <p className="text-sm text-muted-foreground">
                Delete all existing cost codes before uploading new ones
              </p>
            </div>
            <Switch
              id="replace-all"
              checked={replaceAll}
              onCheckedChange={setReplaceAll}
            />
          </div>
        </CardContent>
      </Card>

      <CostCodeImport 
        onImport={handleImport}
      />

      {isUploading && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              <div>
                <p className="font-semibold">Uploading to database...</p>
                <p className="text-sm text-muted-foreground">
                  This may take a moment for large files
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
