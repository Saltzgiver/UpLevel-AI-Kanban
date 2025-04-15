import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRight, Loader2, Save, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

/**
 * Page for customizing the prompt analyzer meta-prompt and testing its effectiveness
 */
export default function PromptAnalyzerSettings() {
  // State for the meta-prompt structure
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('template');
  
  // Template sections
  const [contextSection, setContextSection] = useState('');
  const [analysisGuidelinesSection, setAnalysisGuidelinesSection] = useState('');
  const [imageGenGuidelines, setImageGenGuidelines] = useState('');
  const [spreadsheetGenGuidelines, setSpreadsheetGenGuidelines] = useState('');
  const [textDraftingGuidelines, setTextDraftingGuidelines] = useState('');
  const [contentRefinementGuidelines, setContentRefinementGuidelines] = useState('');
  const [responseFormatSection, setResponseFormatSection] = useState('');
  
  // Test section state
  const [testSourceInstructions, setTestSourceInstructions] = useState('Create a recipe based on the card title.');
  const [testCardTitle, setTestCardTitle] = useState('Burger');
  const [testCardDescription, setTestCardDescription] = useState('A delicious hamburger');
  const [testChatHistory, setTestChatHistory] = useState(
`User: Can you add more spices to the recipe?
AI: I've added more spices to enhance the flavor profile.
User: Can you make the patty thicker?
AI: I've updated the recipe with instructions for a thicker, juicier patty.`
  );
  const [testResult, setTestResult] = useState(null);
  
  const { toast } = useToast();

  // Load the current prompt template on initial load
  useEffect(() => {
    const fetchCurrentTemplate = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/prompt-analyzer/template');
        if (response.ok) {
          const data = await response.json();
          if (data.template) {
            // Set the template sections
            setContextSection(data.template.context || '');
            setAnalysisGuidelinesSection(data.template.analysisGuidelines || '');
            setImageGenGuidelines(data.template.columnSpecificGuidance?.imageGeneration || '');
            setSpreadsheetGenGuidelines(data.template.columnSpecificGuidance?.spreadsheetGeneration || '');
            setTextDraftingGuidelines(data.template.columnSpecificGuidance?.textDrafting || '');
            setContentRefinementGuidelines(data.template.columnSpecificGuidance?.contentRefinement || '');
            setResponseFormatSection(data.template.responseFormat || '');
          }
        } else {
          // If the endpoint doesn't exist yet or returns an error, load default values
          loadDefaultTemplate();
        }
      } catch (error) {
        console.error('Error fetching prompt template:', error);
        loadDefaultTemplate();
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrentTemplate();
  }, []);

  // Load default template if we can't fetch the current one
  const loadDefaultTemplate = () => {
    setContextSection(`You are a specialized AI designed to analyze card interactions and suggest improvements to column prompts in the UpLevel AI Task Management application. Your goal is to make AI interactions more efficient by improving the initial instructions.`);
    
    setAnalysisGuidelinesSection(
`1. Identify patterns in the conversation that suggest the initial prompt could be improved
2. Look for clarification questions the user had to ask that could have been addressed in the initial prompt
3. Consider information that had to be extracted or explained that could be systematically incorporated
4. Focus on reusable patterns, not one-off requests or special cases
5. Consider if the conversation revealed misunderstandings about what the AI should do
6. Analyze the effectiveness of the responses and how they could be improved with better initial instructions`);
    
    setImageGenGuidelines(
`Additional Guidelines for Image Generation:
- Consider if users frequently needed to specify style, composition, or lighting details
- Look for patterns in requested revisions to images (colors, angles, subjects)
- Identify if format specifications (resolution, aspect ratio) were missing
- Check if the prompt needs more guidance on maintaining visual consistency across multiple images`);
    
    setSpreadsheetGenGuidelines(
`Additional Guidelines for Data/Spreadsheet Generation:
- Identify if format specifications (CSV structure, headers) were missing or confusing
- Look for patterns in data organization requests (sorting, grouping)
- Consider if column types or data validation rules should be specified
- Check if the prompt needs clearer guidance on data formatting and computation rules`);
    
    setTextDraftingGuidelines(
`Additional Guidelines for Text Content Creation:
- Check if tone and voice guidance was missing or needed clarification
- Look for patterns in formatting requests (headings, bullet points, paragraphing)
- Identify if length guidelines were missing or insufficient
- Consider if the prompt should include specific structural elements (intro, conclusion, etc.)`);
    
    setContentRefinementGuidelines(
`Additional Guidelines for Content Refinement:
- Look for patterns in what aspects needed refinement (clarity, brevity, technical accuracy)
- Check if the prompt needs clearer guidance on maintaining original meaning
- Identify if style guide adherence instructions were missing
- Consider if the level of editing (light, moderate, substantive) should be specified`);
    
    setResponseFormatSection(
`First provide a detailed rationale for your suggestion on a single line starting with "RATIONALE: ".
Then, on a new line, provide your suggested prompt instructions.

Example:
RATIONALE: The original prompt lacked specific instructions about including environmental impact metrics, which the user had to request separately.
Create compelling marketing copy that emphasizes environmental impact metrics and sustainability benefits. Include specific numbers about waste reduction and carbon footprint when possible.

If no meaningful improvements can be made, simply respond with:
RATIONALE: No improvements needed because [your reasoning]
[original instructions]`);
  };

  // Reset to default template
  const resetToDefault = () => {
    if (confirm('Are you sure you want to reset to the default template? All your customizations will be lost.')) {
      loadDefaultTemplate();
      toast({
        title: 'Template Reset',
        description: 'The template has been reset to default values.',
      });
    }
  };

  // Save the current template
  const saveTemplate = async () => {
    setIsSaving(true);
    try {
      const templateData = {
        context: contextSection,
        analysisGuidelines: analysisGuidelinesSection,
        columnSpecificGuidance: {
          imageGeneration: imageGenGuidelines,
          spreadsheetGeneration: spreadsheetGenGuidelines,
          textDrafting: textDraftingGuidelines,
          contentRefinement: contentRefinementGuidelines
        },
        responseFormat: responseFormatSection
      };

      const response = await apiRequest('POST', '/api/prompt-analyzer/template', templateData);
      
      toast({
        title: 'Template Saved',
        description: 'The prompt analyzer template has been updated.',
      });
    } catch (error) {
      console.error('Error saving prompt template:', error);
      toast({
        title: 'Error',
        description: 'Failed to save the template. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Test the current template with sample data
  const testTemplate = async () => {
    setIsLoading(true);
    try {
      // Format chat history into array format
      const chats = testChatHistory.split('\n\n').map(chat => {
        const roleLine = chat.split(':');
        return {
          role: roleLine[0].trim().toLowerCase() === 'ai' ? 'assistant' : 'user',
          content: roleLine.slice(1).join(':').trim()
        };
      });

      const testData = {
        sourceColumnInstructions: testSourceInstructions,
        cardTitle: testCardTitle,
        cardDescription: testCardDescription,
        chats
      };

      const response = await apiRequest('POST', '/api/test-prompt-suggestion', testData);
      setTestResult(response as any);
      
      toast({
        title: 'Test Complete',
        description: response && response.suggestion ? 'Suggestion generated successfully.' : 'No suggestion was generated.',
      });
    } catch (error) {
      console.error('Error testing prompt template:', error);
      toast({
        title: 'Error',
        description: 'Failed to test the template. Please check your inputs and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container py-10">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Prompt Analyzer Settings</CardTitle>
          <CardDescription>
            Customize the meta-prompt used by the prompt analyzer to generate improvement suggestions.
            This prompt instructs the AI how to analyze card interactions and generate better column prompts.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="template">Template Configuration</TabsTrigger>
          <TabsTrigger value="test">Test & Preview</TabsTrigger>
        </TabsList>
        
        <TabsContent value="template" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Meta-Prompt Template Sections</CardTitle>
              <CardDescription>
                Customize each section of the prompt analyzer meta-prompt to change how it generates suggestions.
                The template contains variables that will be populated with card context and chat history.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="context-section">Context Section</Label>
                    <Textarea 
                      id="context-section" 
                      value={contextSection} 
                      onChange={(e) => setContextSection(e.target.value)}
                      placeholder="Enter the context section of the meta-prompt"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      This section explains the role and purpose of the prompt analyzer to the AI.
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="analysis-guidelines">Analysis Guidelines</Label>
                    <Textarea 
                      id="analysis-guidelines" 
                      value={analysisGuidelinesSection} 
                      onChange={(e) => setAnalysisGuidelinesSection(e.target.value)}
                      placeholder="Enter the analysis guidelines section"
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      This section provides instructions to the AI on how to analyze the conversation history.
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Column-Specific Guidelines</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      These sections provide targeted guidance for different types of columns.
                    </p>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="image-gen-guidelines" className="text-sm">Image Generation</Label>
                        <Textarea 
                          id="image-gen-guidelines" 
                          value={imageGenGuidelines} 
                          onChange={(e) => setImageGenGuidelines(e.target.value)}
                          placeholder="Enter guidelines for image generation columns"
                          rows={4}
                        />
                      </div>

                      <div>
                        <Label htmlFor="spreadsheet-gen-guidelines" className="text-sm">Spreadsheet Generation</Label>
                        <Textarea 
                          id="spreadsheet-gen-guidelines" 
                          value={spreadsheetGenGuidelines} 
                          onChange={(e) => setSpreadsheetGenGuidelines(e.target.value)}
                          placeholder="Enter guidelines for spreadsheet generation columns"
                          rows={4}
                        />
                      </div>

                      <div>
                        <Label htmlFor="text-drafting-guidelines" className="text-sm">Text Drafting</Label>
                        <Textarea 
                          id="text-drafting-guidelines" 
                          value={textDraftingGuidelines} 
                          onChange={(e) => setTextDraftingGuidelines(e.target.value)}
                          placeholder="Enter guidelines for text drafting columns"
                          rows={4}
                        />
                      </div>

                      <div>
                        <Label htmlFor="content-refinement-guidelines" className="text-sm">Content Refinement</Label>
                        <Textarea 
                          id="content-refinement-guidelines" 
                          value={contentRefinementGuidelines} 
                          onChange={(e) => setContentRefinementGuidelines(e.target.value)}
                          placeholder="Enter guidelines for content refinement columns"
                          rows={4}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="response-format">Response Format</Label>
                    <Textarea 
                      id="response-format" 
                      value={responseFormatSection} 
                      onChange={(e) => setResponseFormatSection(e.target.value)}
                      placeholder="Enter the response format section"
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      This section describes how the AI should format its response. Keep the RATIONALE: prefix for proper parsing.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={resetToDefault} disabled={isLoading || isSaving}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset to Default
              </Button>
              <Button onClick={saveTemplate} disabled={isLoading || isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Template
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="test" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Prompt Analyzer</CardTitle>
              <CardDescription>
                Test your custom template with sample data to see how it generates suggestions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="test-column-instructions">Column Instructions</Label>
                  <Textarea 
                    id="test-column-instructions" 
                    value={testSourceInstructions} 
                    onChange={(e) => setTestSourceInstructions(e.target.value)}
                    placeholder="Enter test column instructions"
                    rows={3}
                  />
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="test-card-title">Card Title</Label>
                    <Input 
                      id="test-card-title" 
                      value={testCardTitle} 
                      onChange={(e) => setTestCardTitle(e.target.value)}
                      placeholder="Enter test card title"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="test-card-description">Card Description</Label>
                    <Input 
                      id="test-card-description" 
                      value={testCardDescription} 
                      onChange={(e) => setTestCardDescription(e.target.value)}
                      placeholder="Enter test card description"
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="test-chat-history">Chat History</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Format as "User: message" and "AI: response" with blank lines between entries
                </p>
                <Textarea 
                  id="test-chat-history" 
                  value={testChatHistory} 
                  onChange={(e) => setTestChatHistory(e.target.value)}
                  placeholder="Enter test chat history"
                  rows={6}
                />
              </div>
              
              <Button onClick={testTemplate} disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                Test Prompt Analyzer
              </Button>
              
              {testResult && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <h3 className="text-sm font-medium mb-2">Result:</h3>
                  {testResult.suggestion ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium">Rationale:</h4>
                        <p className="text-sm">{typeof testResult.suggestion === 'object' && testResult.suggestion?.rationale}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">Suggested Instructions:</h4>
                        <p className="text-sm whitespace-pre-wrap">{typeof testResult.suggestion === 'object' && testResult.suggestion?.suggestedInstructions}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm">No suggestion was generated. The analyzer may have determined that the current instructions are already optimal.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}