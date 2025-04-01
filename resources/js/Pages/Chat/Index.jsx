import { useState, useRef, useEffect } from 'react';
import { Head } from '@inertiajs/react';

export default function Index() {
    const [prompt, setPrompt] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [streamingMessage, setStreamingMessage] = useState('');
    const [displayedMessage, setDisplayedMessage] = useState('');
    
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, displayedMessage]);

    useEffect(() => {
        if (streamingMessage) {
            let i = 0;
            const interval = setInterval(() => {
                if (i < streamingMessage.length) {
                    setDisplayedMessage((prev) => prev + streamingMessage[i]);
                    i++;
                } else {
                    clearInterval(interval);
                }
            }, 30);  // Adjust speed of typing effect
            return () => clearInterval(interval);
        }
    }, [streamingMessage]);

    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!prompt.trim()) return;

        const newMessage = { role: 'user', content: prompt };
        setMessages((prev) => [...prev, newMessage]);
        setLoading(true);
        setStreamingMessage('');
        setDisplayedMessage('');

        try {
            const response = await fetch(`/chat/generate?prompt=${encodeURIComponent(prompt)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,  
                },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                console.error('Error fetching stream');
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let done = false;
            let buffer = '';  

            while (!done) {
                const { value, done: streamDone } = await reader.read();
                done = streamDone;

                if (value) {
                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;

                    const lines = buffer.split('\n');
                    
                    for (let i = 0; i < lines.length - 1; i++) {
                        const line = lines[i].trim();

                        if (line) {
                            try {
                                const json = JSON.parse(line);
                                if (json.response) {
                                    setStreamingMessage((prev) => prev + json.response);
                                }
                            } catch (error) {
                                console.error('Error parsing JSON:', error);
                            }
                        }
                    }

                    buffer = lines[lines.length - 1];
                }
            }

            const botMessage = { role: 'ai', content: streamingMessage };
            setMessages((prev) => [...prev, botMessage]);
            setPrompt('');
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
            <Head title="AI Chat" />
            <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
                <h1 className="text-2xl font-bold mb-4">Suraj GPT</h1>
                
                <div className="h-96 overflow-y-auto border p-4 rounded-lg bg-gray-100">
                    {messages.map((msg, index) => (
                        <div
                            key={index}
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
                            </div>
                        </div>
                    ))}

                    {streamingMessage && (
                        <div className="text-left animate-pulse">
                            <div className="inline-block bg-gray-300 text-gray-900 px-4 py-2 rounded-lg">
                                <span className="whitespace-pre-wrap">{displayedMessage}</span>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />

                    {loading && <div className="text-center mt-2 text-gray-500">Generating...</div>}
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
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
}
