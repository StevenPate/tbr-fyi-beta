<svelte:head>
	<title>About - TBR.fyi</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-blue-50 to-white">
	<div class="max-w-3xl mx-auto px-4 py-16">
		<!-- Header -->
		<div class="text-center mb-12">
			<h1 class="text-4xl font-bold text-gray-900 mb-3">
				About TBR.fyi
			</h1>
			<p class="text-lg text-gray-600">
				Your Personal Reading Inbox
			</p>
		</div>

		<!-- What This Is -->
		<div class="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
			<h2 class="text-2xl font-semibold text-gray-900 mb-4">📚 What This Is</h2>

			<div class="space-y-4 text-gray-700">
				<p>
					TBR.fyi is a tool I built to solve a problem I have: <strong>I lose track of book recommendations.</strong>
				</p>

				<p>
					I hear about books everywhere—podcasts, friends, social media—and by the time I'm at a bookstore or library, I've forgotten half of them.
				</p>

				<p>
					So I built this: Text an ISBN (or Amazon link, or photo of a barcode, or just search by title) to a number, and the book appears on your personal shelf with cover, title, author, and description. That's it.
				</p>
			</div>
		</div>

		<!-- How it Works -->
		<div class="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
			<h2 class="text-2xl font-semibold text-gray-900 mb-4">⚙️ How It Works</h2>

			<div class="space-y-4 text-gray-700">
				<ol class="space-y-3">
					<li class="flex gap-3">
						<span class="font-bold text-blue-600 flex-shrink-0">1.</span>
						<span>Text an ISBN, Amazon link, photo of a barcode, or "Title by Author" to <strong>+1 (360) 504-4327</strong></span>
					</li>
					<li class="flex gap-3">
						<span class="font-bold text-blue-600 flex-shrink-0">2.</span>
						<span>Your shelf updates with the book details</span>
					</li>
					<li class="flex gap-3">
						<span class="font-bold text-blue-600 flex-shrink-0">3.</span>
						<span>Check it anytime at your personal shelf page</span>
					</li>
					<li class="flex gap-3">
						<span class="font-bold text-blue-600 flex-shrink-0">4.</span>
						<span>Mark books read/unread and owned/not owned with simple toggles</span>
					</li>
					<li class="flex gap-3">
						<span class="font-bold text-blue-600 flex-shrink-0">5.</span>
						<span>Add notes like "Recommended on Fresh Air" so you remember the context</span>
					</li>
				</ol>

				<p class="mt-4 text-base font-medium">
					No app to install. No password to forget. Just text and check.
				</p>
			</div>
		</div>

		<!-- What Stage This Is At -->
		<div class="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
			<h2 class="text-2xl font-semibold text-gray-900 mb-4">🚧 What Stage This Is At</h2>

			<div class="space-y-4 text-gray-700">
				<p>
					<strong>Honest truth:</strong> This is very early. I'm testing it with a small group to see if it's useful or if I'm solving a problem that doesn't exist.
				</p>

				<div class="mt-6">
					<h3 class="text-lg font-semibold text-gray-900 mb-3">Things that work:</h3>
					<ul class="space-y-2 text-sm">
						<li>✅ Text ISBN → book appears on shelf</li>
						<li>✅ Photo barcode detection (send a picture of the barcode)</li>
						<li>✅ Amazon link parsing (paste any Amazon book URL)</li>
						<li>✅ Title/author search (text "The Hobbit by Tolkien")</li>
						<li>✅ Multiple custom shelves (TBR, Favorites, etc.)</li>
						<li>✅ Mark books read/unread and owned/not owned</li>
						<li>✅ Add personal notes to any book</li>
						<li>✅ Show barcode to booksellers (for in-store lookup)</li>
						<li>✅ Publication dates and descriptions</li>
					</ul>
				</div>

				<div class="mt-6">
					<h3 class="text-lg font-semibold text-gray-900 mb-3">Things that could be better:</h3>
					<ul class="space-y-2 text-sm text-gray-600">
						<li>⚠️ Long lists need pagination</li>
						<li>⚠️ No different edition finder yet</li>
						<li>⚠️ Can't export to CSV or Goodreads format</li>
						<li>⚠️ It might be slow sometimes</li>
						<li>⚠️ Probably other stuff I haven't discovered</li>
					</ul>
				</div>

				<p class="mt-4 text-base">
					If something breaks, please tell me. That's actually helpful.
				</p>
			</div>
		</div>

		<!-- Why I Built This -->
		<div class="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
			<h2 class="text-2xl font-semibold text-gray-900 mb-4">💡 Why I Built This</h2>

			<div class="space-y-4 text-gray-700">
				<p>
					I was using Goodreads' "to-read" list, but I never actually checked it. It became a graveyard of 200 books I'll never read.
				</p>

				<p>I wanted something that:</p>
				<ul class="space-y-2 ml-6 list-disc">
					<li><strong>Requires zero friction</strong> – no app to open, no login</li>
					<li><strong>Captures the moment</strong> – text while listening to a podcast</li>
					<li><strong>Shows me my list</strong> – when I'm actually at a bookstore</li>
					<li><strong>Tracks what I own</strong> – so I don't buy duplicates</li>
				</ul>

				<p class="mt-4">
					If this works for me and a few other people, maybe it's worth building properly. If not, I learned something and move on.
				</p>
			</div>
		</div>

		<!-- Privacy & Data -->
		<div class="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
			<h2 class="text-2xl font-semibold text-gray-900 mb-4">🔒 Privacy & Data</h2>

			<div class="space-y-4 text-gray-700">
				<div>
					<h3 class="text-base font-semibold text-gray-900 mb-2">What I collect:</h3>
					<ul class="space-y-1 text-sm ml-4">
						<li>• Your phone number (as your user ID)</li>
						<li>• Books you add (ISBN, title, author, cover, description)</li>
						<li>• Your notes and read/owned status</li>
						<li>• Your custom shelves and organization</li>
						<li>• SMS consent status (START/STOP commands)</li>
					</ul>
				</div>

				<div>
					<h3 class="text-base font-semibold text-gray-900 mb-2">What I don't collect:</h3>
					<ul class="space-y-1 text-sm ml-4">
						<li>• Anything else</li>
						<li>• I'm not selling your data</li>
						<li>• I'm not sending you marketing emails</li>
						<li>• SMS message content is only processed, not saved</li>
					</ul>
				</div>

				<p class="text-sm mt-4">
					This is a personal project, not a venture-backed startup (yet?).
				</p>

				<div class="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
					<p class="text-sm">
						<strong>Can I delete my data?</strong> Yes. Text STOP to opt out of SMS messages. To completely delete your account and data, open an issue on <a href="https://github.com/stevenpate/tbr-fyi-beta/issues" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">GitHub</a> or contact me.
					</p>
				</div>
			</div>
		</div>

		<!-- Technical Stack -->
		<div class="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
			<h2 class="text-2xl font-semibold text-gray-900 mb-4">🛠️ Technical Stack</h2>

			<div class="grid grid-cols-2 gap-4 text-sm">
				<div class="bg-gray-50 rounded-lg p-3">
					<div class="font-semibold text-gray-900 mb-1">Frontend</div>
					<div class="text-gray-600">SvelteKit 5</div>
				</div>
				<div class="bg-gray-50 rounded-lg p-3">
					<div class="font-semibold text-gray-900 mb-1">Database</div>
					<div class="text-gray-600">Supabase (PostgreSQL)</div>
				</div>
				<div class="bg-gray-50 rounded-lg p-3">
					<div class="font-semibold text-gray-900 mb-1">SMS</div>
					<div class="text-gray-600">Twilio</div>
				</div>
				<div class="bg-gray-50 rounded-lg p-3">
					<div class="font-semibold text-gray-900 mb-1">Metadata</div>
					<div class="text-gray-600">Google Books API</div>
				</div>
				<div class="bg-gray-50 rounded-lg p-3">
					<div class="font-semibold text-gray-900 mb-1">Barcode Detection</div>
					<div class="text-gray-600">Google Cloud Vision</div>
				</div>
				<div class="bg-gray-50 rounded-lg p-3">
					<div class="font-semibold text-gray-900 mb-1">Hosting</div>
					<div class="text-gray-600">Vercel</div>
				</div>
			</div>
		</div>

		<!-- Open Source -->
		<div class="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
			<h2 class="text-2xl font-semibold text-gray-900 mb-4">🌟 Open Source</h2>

			<div class="space-y-4 text-gray-700">
				<p>
					TBR.fyi is built in the open. The code is available on GitHub, and contributions are welcome.
				</p>

				<div class="flex flex-col sm:flex-row gap-3 mt-6">
					<a
						href="https://github.com/stevenpate/tbr-fyi-beta"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
					>
						<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
							<path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd"></path>
						</svg>
						View on GitHub
					</a>
					<a
						href="https://github.com/stevenpate/tbr-fyi-beta/issues"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
					>
						Report an Issue
					</a>
				</div>
			</div>
		</div>

		<!-- Feedback -->
		<div class="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
			<h2 class="text-2xl font-semibold text-gray-900 mb-4">💬 Feedback</h2>

			<div class="space-y-4 text-gray-700">
				<p>
					If you have thoughts—good or bad—I want to hear them.
				</p>

				<div class="space-y-2 text-sm">
					<p>
						<strong class="text-gray-900">GitHub:</strong> <a href="https://github.com/stevenpate/tbr-fyi-beta/issues" target="_blank" rel="noopener noreferrer" class="underline hover:text-blue-600">Open an issue</a>
					</p>
				</div>

				<div class="mt-6">
					<p class="font-semibold text-gray-900 mb-2">Specific things that are helpful:</p>
					<ul class="space-y-1 text-sm ml-4">
						<li>• "I stopped using it because..."</li>
						<li>• "This is confusing..."</li>
						<li>• "I wish it did..."</li>
						<li>• "I use it when..."</li>
					</ul>
				</div>

				<div class="mt-4">
					<p class="font-semibold text-gray-900 mb-2">Things that are less helpful:</p>
					<ul class="space-y-1 text-sm ml-4 text-gray-600">
						<li>• "It's cool!" (but why?)</li>
						<li>• "You should add [50 features]" (maybe, but why?)</li>
					</ul>
				</div>
			</div>
		</div>

		<!-- FAQ -->
		<div class="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
			<h2 class="text-2xl font-semibold text-gray-900 mb-4">❓ FAQ</h2>

			<div class="space-y-4">
				<details class="group">
					<summary class="font-semibold text-gray-900 cursor-pointer hover:text-blue-600 flex items-center gap-2">
						<span class="group-open:rotate-90 transition-transform">▶</span>
						Why SMS instead of an app?
					</summary>
					<p class="mt-2 ml-6 text-sm text-gray-700">
						I wanted zero friction. No app to install, no account to create. Just text and it works. If people hate this, I'll reconsider.
					</p>
				</details>

				<details class="group">
					<summary class="font-semibold text-gray-900 cursor-pointer hover:text-blue-600 flex items-center gap-2">
						<span class="group-open:rotate-90 transition-transform">▶</span>
						Will this always be free?
					</summary>
					<p class="mt-2 ml-6 text-sm text-gray-700">
						For testing, yes. Long-term, maybe a free tier with limited SMS + a paid unlimited plan. But I'm not charging anyone until I prove this is actually useful.
					</p>
				</details>

				<details class="group">
					<summary class="font-semibold text-gray-900 cursor-pointer hover:text-blue-600 flex items-center gap-2">
						<span class="group-open:rotate-90 transition-transform">▶</span>
						Can I invite friends?
					</summary>
					<p class="mt-2 ml-6 text-sm text-gray-700">
						Yes! Anyone can text START to +1 (360) 504-4327 to begin using TBR.fyi. Just be aware this is still early and things might break occasionally.
					</p>
				</details>

				<details class="group">
					<summary class="font-semibold text-gray-900 cursor-pointer hover:text-blue-600 flex items-center gap-2">
						<span class="group-open:rotate-90 transition-transform">▶</span>
						Will you add [feature X]?
					</summary>
					<p class="mt-2 ml-6 text-sm text-gray-700">
						Maybe! Right now I'm focused on making the core loop work well. If people actually use this, I'll add more features based on what they need most. Check the <a href="https://github.com/stevenpate/tbr-fyi-beta" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">roadmap on GitHub</a>.
					</p>
				</details>
			</div>
		</div>

		<!-- Thank You -->
		<div class="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-xl p-8 text-white">
			<h2 class="text-2xl font-semibold mb-4">🙏 Thank You</h2>

			<div class="space-y-3 text-blue-50">
				<p>
					Seriously—thanks for trying this. Whether you use it 100 times or once, you're helping me figure out if this is worth pursuing.
				</p>

				<p>
					If it's useful for you, great! If not, no hard feelings. At least we tried.
				</p>
			</div>
		</div>
	</div>
</div>
