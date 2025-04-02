import { useState, useRef, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';

export default function ResumeChat() {
    const [prompt, setPrompt] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fileLoading, setFileLoading] = useState(false);
    const [hasResume, setHasResume] = useState(false); // Changed from resumeContent
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setFileLoading(true);
        
        const formData = new FormData();
        formData.append('resume', file);

        try {
            const response = await fetch('/resume/upload', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                },
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                setHasResume(true);
                setMessages([{
                    id: Date.now(),
                    role: 'system',
                    content: 'Resume uploaded successfully. You can now ask questions about it.'
                }]);
            } else {
                throw new Error(data.message || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            setMessages([{
                id: Date.now(),
                role: 'system',
                content: 'Error uploading resume: ' + error.message
            }]);
        } finally {
            setFileLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!prompt.trim() || loading || !hasResume) return;
    
        const userMessage = {
            id: Date.now(),
            role: 'user',
            content: prompt,
        };
        
        setMessages(prev => [...prev, userMessage]);
        setPrompt('');
        setLoading(true);
        
        // Create assistant message with empty content
        const assistantMessageId = Date.now() + 1;
        setMessages(prev => [...prev, {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            streaming: true
        }]);
    
        try {
            const response = await fetch('/resume/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                    'Accept': 'text/event-stream',
                },
                body: JSON.stringify({ prompt }),
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
    
            if (!response.body) {
                throw new Error('ReadableStream not supported');
            }
    
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessageContent = '';
    
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
    
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6).trim();
                        
                        if (data === '[DONE]') {
                            break;
                        }
                        
                        try {
                            const parsed = JSON.parse(data);
                            
                            if (parsed.error) {
                                throw new Error(parsed.error);
                            }
                            
                            if (parsed.content) {
                                assistantMessageContent += parsed.content;
                                
                                // Update the message with the new content
                                setMessages(prev => prev.map(msg => 
                                    msg.id === assistantMessageId 
                                        ? { ...msg, content: assistantMessageContent } 
                                        : msg
                                ));
                            }
                        } catch (e) {
                            console.error('Error parsing SSE data:', e);
                        }
                    }
                }
            }
            
            // Mark streaming as complete
            setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId 
                    ? { ...msg, streaming: false } 
                    : msg
            ));
        } catch (error) {
            console.error('Error:', error);
            setMessages(prev => [...prev, {
                id: Date.now(),
                role: 'system',
                content: 'Error generating response: ' + error.message
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
            <Head title="Chat" />
            <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold">Resume Q&A</h1>
                    <Link href="/chat" className="text-blue-500 hover:text-blue-700">
                        Back to SurajGpt
                    </Link>
                </div>
                
                {!hasResume && (
                    <div className="mb-6 p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
                        <p className="mb-4">Upload your resume to start asking questions</p>
                        <button
                            onClick={() => fileInputRef.current.click()}
                            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                            disabled={fileLoading}
                        >
                            {fileLoading ? 'Uploading...' : 'Upload Resume'}
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept=".pdf,.doc,.docx,.txt"
                            className="hidden"
                        />
                        <p className="mt-2 text-sm text-gray-500">Supports PDF, DOC, DOCX, TXT (max 2MB)</p>
                    </div>
                )}

                <div className="h-96 overflow-y-auto border p-4 rounded-lg bg-gray-100 mb-4">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
                        >
                            <div
                                className={`inline-block px-4 py-2 rounded-lg ${
                                    msg.role === 'user'
                                        ? 'bg-blue-500 text-white'
                                        : msg.role === 'system'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-gray-300 text-gray-900'
                                }`}
                            >
                                {msg.content}
                                {msg.streaming && (
                                    <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-gray-600"></span>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
                    <input
                        type="text"
                        className="w-full p-2 border rounded-lg"
                        placeholder={hasResume ? "Ask about this resume..." : "Upload a resume first..."}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={loading || !hasResume}
                    />
                    <button
                        type="submit"
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
                        disabled={loading || !hasResume || !prompt.trim()}
                    >
                        {loading ? 'Generating...' : 'Ask'}
                    </button>
                </form>
            </div>
        </div>
    );
}