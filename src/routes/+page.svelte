<script lang="ts">
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';

    let identifier = $state('');

    onMount(() => {
        // Check if user has visited before
        const savedId = localStorage.getItem('tbr-userId') || '';
        if (savedId) {
            identifier = savedId;
        }
    });

    function handleSubmit(e: Event) {
        e.preventDefault();
        if (!identifier) return;

        const trimmed = identifier.trim();

        // Check if it looks like a username (contains letters, no + prefix)
        const hasLetters = /[a-zA-Z]/.test(trimmed);
        const isPhoneFormat = trimmed.startsWith('+') || /^\d{10,}$/.test(trimmed.replace(/\D/g, ''));

        if (hasLetters && !isPhoneFormat) {
            // It's a username - navigate directly
            goto(`/${encodeURIComponent(trimmed)}`);
        } else {
            // It's a phone number - normalize it
            let normalized = trimmed.replace(/\D/g, '');
            if (normalized.length === 10) {
                normalized = '+1' + normalized;
            } else if (normalized.length === 11 && normalized.startsWith('1')) {
                normalized = '+' + normalized;
            } else if (!trimmed.startsWith('+')) {
                normalized = '+' + normalized;
            } else {
                normalized = trimmed; // Already has + prefix
            }

            localStorage.setItem('tbr-userId', normalized);
            goto(`/${encodeURIComponent(normalized)}`);
        }
    }
</script>

<svelte:head>
    <title>TBR.fyi - Never Lose a Book Recommendation</title>
    <meta name="description" content="A simple way to save book recommendations. Text an ISBN, paste an Amazon link, or add books from the web. Everything lands in one calm, searchable reading list." />
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-blue-50 to-white">
    <div class="max-w-2xl mx-auto px-4 py-16">
        <!-- Hero -->
        <div class="text-center mb-12">
            <h1 class="text-4xl font-bold text-gray-900 mb-6">
                Never lose a book recommendation again
            </h1>
            <p class="text-xl text-gray-700 leading-relaxed">
                Someone mentions a book on a podcast, in a group chat, or across the table from you—text it to TBR.fyi and it lands on your shelf. No app to install. No account to remember.
            </p>
        </div>

        <!-- Try It Now -->
        <div class="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900 mb-4 text-center">Try it now</h2>

            <div class="text-center mb-2">
                <a href="sms:+13605044327" class="font-mono text-2xl text-blue-600 font-semibold hover:text-blue-800 transition-colors">
                    +1 (360) 504-4327
                </a>
            </div>
            <p class="text-xs text-gray-500 text-center mb-6">US number · standard messaging rates apply</p>

            <div class="text-sm text-gray-600 space-y-2 text-center">
                <p>Text a title and author: <span class="font-mono bg-gray-100 px-2 py-0.5 rounded">The Hobbit by Tolkien</span></p>
                <p>Or an ISBN: <span class="font-mono bg-gray-100 px-2 py-0.5 rounded">9780547928227</span></p>
                <p>Or a photo of a barcode</p>
                <p>Or an Amazon link</p>
            </div>
        </div>

        <!-- Already Using It -->
        <div class="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900 mb-4 text-center">Already using it?</h2>

            <form class="space-y-4" onsubmit={handleSubmit}>
                <div>
                    <label for="identifier" class="sr-only">Phone number or username</label>
                    <input
                        type="text"
                        id="identifier"
                        name="identifier"
                        bind:value={identifier}
                        placeholder="Enter your phone number or username"
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                    />
                </div>
                <button
                    type="submit"
                    disabled={!identifier}
                    class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                    View your shelf
                </button>
            </form>

            <p class="text-sm text-gray-500 text-center mt-4">
                Text <span class="font-mono">HELP</span> to the number above for commands, or see the <a href="/help" class="text-blue-600 hover:text-blue-800 underline">help page</a>.
            </p>
        </div>

        <!-- Feedback Note -->
        <div class="text-center text-sm text-gray-600">
            <p>
                This is early. If you have thoughts—or something breaks—the feedback button in the corner is there for a reason.
            </p>
        </div>

        <!-- Links -->
        <div class="text-center mt-8 text-sm text-gray-500">
            <a href="/about" class="text-blue-600 hover:text-blue-800 underline">About</a>
            <span class="mx-2">·</span>
            <a href="/help" class="text-blue-600 hover:text-blue-800 underline">Help</a>
        </div>
    </div>
</div>
