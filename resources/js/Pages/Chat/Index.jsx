import { useState, useRef, useEffect } from 'react';
import { Head } from '@inertiajs/react';

export default function Index() {
    const [prompt, setPrompt] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const bufferRef = useRef('');

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!prompt.trim() || loading) return;

        const userMessage = { 
            id: Date.now(),
            role: 'user', 
            content: prompt 
        };
        
        // Add user message and empty AI response placeholder
        const aiMessageId = Date.now() + 1;
        setMessages(prev => [
            ...prev, 
            userMessage,
            { 
                id: aiMessageId,
                role: 'ai', 
                content: '',
                streaming: true 
            }
        ]);
        
        setPrompt('');
        setLoading(true);
        bufferRef.current = ''; // Reset buffer for new stream

        try {
            const response = await fetch('/chat/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                    'Accept': 'text/event-stream',
                },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                bufferRef.current += chunk;

                // Process complete lines from the buffer
                const lines = bufferRef.current.split('\n');
                for (let i = 0; i < lines.length - 1; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    try {
                        const data = JSON.parse(line);
                        if (data.response) {
                            fullResponse += data.response;
                            // Update only the streaming message
                            setMessages(prev => prev.map(msg => 
                                msg.id === aiMessageId 
                                    ? { ...msg, content: fullResponse } 
                                    : msg
                            ));
                        }
                    } catch (e) {
                        console.error('Error parsing JSON:', e, 'Line:', line);
                    }
                }

                // Keep the last incomplete line in the buffer
                bufferRef.current = lines[lines.length - 1];
            }

            // Mark streaming as complete
            setMessages(prev => prev.map(msg => 
                msg.id === aiMessageId 
                    ? { ...msg, streaming: false } 
                    : msg
            ));
        } catch (error) {
            console.error('Error:', error);
            setMessages(prev => prev.map(msg => 
                msg.id === aiMessageId 
                    ? { ...msg, content: 'Error: ' + error.message, streaming: false } 
                    : msg
            ));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
            <Head title="AI Chat" />
            <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
                <h1 className="text-2xl font-bold mb-4">ChatGPT</h1>
                
                <div className="h-96 overflow-y-auto border p-4 rounded-lg bg-gray-100">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
                        >
                            <div
                                className={`inline-block px-4 py-2 rounded-lg ${
                                    msg.role === 'user'
                                        ? 'bg-blue-500 text-white'
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
                        placeholder="Type your prompt..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
                        disabled={loading}
                    >
                        {loading ? 'Generating...' : 'Send'}
                    </button>
                </form>
            </div>
        </div>
    );
}