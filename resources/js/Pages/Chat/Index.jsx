import { useState, useRef, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';

export default function Index() {
    const [prompt, setPrompt] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);

    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!prompt.trim()) return;

        const newMessage = { role: 'user', content: prompt };
        setMessages((prev) => [...prev, newMessage]);
        setLoading(true);

        try {
            const response = await axios.post(route('chat.generate'), { prompt });
            const botMessage = { role: 'ai', content: response.data.response };
            setMessages((prev) => [...prev, botMessage]);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
            setPrompt('');
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
            <Head title="AI Chat" />
            <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
                <h1 className="text-2xl font-bold mb-4">Ollama AI Chat</h1>
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
                    
                    <div ref={messagesEndRef} />
                    
                    {loading && (
                        <div className="text-center mt-2 text-gray-500">Generating...</div>
                    )}
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="mt-4 flex items-center gap-2"
                >
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
