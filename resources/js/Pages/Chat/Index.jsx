import { useState, useRef, useEffect } from 'react';
import { Head } from '@inertiajs/react';

export default function Index() {
    const [prompt, setPrompt] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const bufferRef = useRef('');
    const animationRef = useRef(null);
    const [displayedMessages, setDisplayedMessages] = useState({});

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, displayedMessages]);

    // Typing animation effect
    useEffect(() => {
        const animateText = () => {
            setMessages(prevMessages => {
                const updatedMessages = prevMessages.map(msg => {
                    if (msg.streaming && displayedMessages[msg.id] !== msg.content) {
                        const currentDisplay = displayedMessages[msg.id] || '';
                        const targetText = msg.content;
                        
                        if (currentDisplay.length < targetText.length) {
                            const newDisplay = targetText.substring(0, currentDisplay.length + 1);
                            setDisplayedMessages(prev => ({
                                ...prev,
                                [msg.id]: newDisplay
                            }));
                        } else {
                            // Animation complete
                            return { ...msg, streaming: false };
                        }
                    }
                    return msg;
                });
                return updatedMessages;
            });
        };

        animationRef.current = requestAnimationFrame(function animate() {
            animateText();
            animationRef.current = requestAnimationFrame(animate);
        });

        return () => {
            cancelAnimationFrame(animationRef.current);
        };
    }, [displayedMessages]);

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
        bufferRef.current = '';
        setDisplayedMessages(prev => ({ ...prev, [aiMessageId]: '' }));

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

            const processChunk = (chunk) => {
                bufferRef.current += chunk;
                const lines = bufferRef.current.split('\n');
                
                // Process all complete lines except the last one
                for (let i = 0; i < lines.length - 1; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    // Handle cases where multiple JSON objects might be concatenated
                    const jsonObjects = line.split('}{').map((obj, index) => {
                        if (index === 0) return obj + (line.includes('}{') ? '}' : '');
                        return '{' + obj + (index === line.split('}{').length - 2 ? '}' : '');
                    }).filter(obj => obj.trim().startsWith('{'));

                    for (const obj of jsonObjects) {
                        try {
                            const data = JSON.parse(obj);
                            if (data.response) {
                                fullResponse += data.response;
                                setMessages(prev => prev.map(msg => 
                                    msg.id === aiMessageId 
                                        ? { ...msg, content: fullResponse } 
                                        : msg
                                ));
                            }
                        } catch (e) {
                            console.error('Error parsing JSON:', e, 'Object:', obj);
                        }
                    }
                }

                // Keep the last incomplete line in buffer
                bufferRef.current = lines[lines.length - 1];
            };

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                processChunk(decoder.decode(value, { stream: true }));
            }

            // Process any remaining data in buffer
            if (bufferRef.current.trim()) {
                processChunk('');
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
                                className={`inline-block px-4 py-2 rounded-lg transition-all duration-100 ${
                                    msg.role === 'user'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-300 text-gray-900'
                                }`}
                            >
                                {msg.role === 'user' 
                                    ? msg.content 
                                    : (displayedMessages[msg.id] || '')}
                                
                                {msg.streaming && (
                                    <>
                                        <span className="typing-cursor">|</span>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
                    <input
                        type="text"
                        className="w-full p-2 border rounded-lg transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Type your prompt..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors duration-200"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="flex items-center">
                                <span className="animate-spin mr-2">↻</span>
                                Generating...
                            </span>
                        ) : 'Send'}
                    </button>
                </form>
            </div>

            <style jsx>{`
                .typing-cursor {
                    display: inline-block;
                    margin-left: 2px;
                    animation: blink 1s step-end infinite;
                }
                @keyframes blink {
                    from, to { opacity: 1; }
                    50% { opacity: 0; }
                }
            `}</style>
        </div>
    );
}