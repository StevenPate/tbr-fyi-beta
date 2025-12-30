<svelte:head>
	<title>About TBR.fyi - Never Lose a Book Recommendation</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-blue-50 to-white">
	<div class="max-w-3xl mx-auto px-4 py-16">
		<!-- Header -->
		<div class="text-center mb-12">
			<h1 class="text-4xl font-bold text-gray-900 mb-4">
				About TBR.fyi
			</h1>
			<p class="text-xl text-gray-700 leading-relaxed">
				A simple way to never lose a book recommendation again.
			</p>
		</div>

		<!-- Intro -->
		<div class="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
			<p class="text-gray-700 text-lg leading-relaxed">
				Someone mentions a book on a podcast, in a group chat, or across the table from you—and you can save it instantly. No notes app, no screenshots, no forgotten tabs. Everything lands in one calm, searchable reading list.
			</p>
		</div>

		<!-- Why This Exists -->
		<div class="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
			<h2 class="text-2xl font-semibold text-gray-900 mb-4">Why this exists</h2>

			<div class="space-y-4 text-gray-700">
				<p>
					I was using Goodreads' "to-read" list, but I never actually checked it. It became a graveyard of 200 books I'll never read.
				</p>

				<p>
					Book recommendations come from everywhere, and they almost always arrive when you're busy. TBR.fyi is designed to capture those moments with as little friction as possible—whether you're on your phone, at your desk, or mid-conversation.
				</p>

				<p class="font-medium">
					No feeds. No algorithms. Just a place to put the books you actually want to read.
				</p>
			</div>
		</div>

		<!-- How It Works -->
		<div class="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
			<h2 class="text-2xl font-semibold text-gray-900 mb-4">How it works</h2>

			<div class="space-y-4 text-gray-700">
				<p>
					There are two ways to add books—use whichever fits the moment:
				</p>

				<div class="bg-gray-50 rounded-lg p-4 mt-4">
					<p class="font-semibold text-gray-900 mb-2">Text it in.</p>
					<p class="text-sm mb-3">
						Send a photo of a book cover, an ISBN, a link, or just the title:
					</p>
					<div class="bg-white border-2 border-blue-200 rounded-lg p-3 text-center my-3">
						<a href="sms:+13605044327" class="font-mono text-xl text-blue-600 font-semibold hover:text-blue-800 transition-colors">
							+1 (360) 504-4327
						</a>
						<p class="text-xs text-gray-500 mt-1">US number · standard messaging rates apply</p>
					</div>
					<p class="text-sm text-gray-600">
						TBR.fyi figures out the book and adds it to your list automatically.
					</p>
				</div>

				<div class="bg-gray-50 rounded-lg p-4">
					<p class="font-semibold text-gray-900 mb-2">Use the web app.</p>
					<p class="text-sm text-gray-600">
						You can also add books directly here—same result, same list, no SMS required.
					</p>
				</div>

				<p class="mt-4">
					Once added, books show up in your TBR list. You can mark them read or unread, note whether you own them, and add context like "Recommended on Fresh Air" so you remember why you saved it.
				</p>
			</div>
		</div>

		<!-- What It Is (and Isn't) -->
		<div class="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
			<h2 class="text-2xl font-semibold text-gray-900 mb-4">What it is (and isn't)</h2>

			<div class="space-y-4 text-gray-700">
				<p>
					TBR.fyi is a lightweight tool for capturing and organizing book recommendations. It's fast, forgiving, and intentionally simple—built for real life, not perfect data entry.
				</p>

				<p>
					It isn't a social network. It isn't a recommendation engine. It isn't a reading tracker with stats and streaks.
				</p>
			</div>
		</div>

		<!-- Where This Is At -->
		<div class="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
			<h2 class="text-2xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
				<span class="text-xl">🚧</span> Where this is at
			</h2>

			<div class="space-y-4 text-gray-700">
				<p>
					<strong>Honest truth:</strong> this is early. I'm testing it with a small group to see if it's useful or if I'm solving a problem that doesn't exist.
				</p>

				<div class="mt-6">
					<h3 class="text-base font-semibold text-gray-900 mb-3">Things that work:</h3>
					<ul class="space-y-1 text-sm ml-4">
						<li>• Text ISBN → book appears on shelf</li>
						<li>• Photo barcode detection</li>
						<li>• Amazon link parsing</li>
						<li>• Title/author search ("The Hobbit by Tolkien")</li>
						<li>• Multiple shelves, read/unread status, personal notes</li>
					</ul>
				</div>

				<div class="mt-6">
					<h3 class="text-base font-semibold text-gray-900 mb-3">Things that could be better:</h3>
					<ul class="space-y-1 text-sm text-gray-600 ml-4">
						<li>• Long lists need pagination</li>
						<li>• No edition finder yet</li>
						<li>• Can't export to CSV or Goodreads</li>
						<li>• Probably other stuff I haven't discovered</li>
					</ul>
				</div>

				<p class="mt-4">
					If something breaks, telling me is genuinely helpful.
				</p>
			</div>
		</div>

		<!-- Feedback -->
		<div class="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
			<h2 class="text-2xl font-semibold text-gray-900 mb-4">Feedback</h2>

			<div class="space-y-4 text-gray-700">
				<p>
					If you have thoughts—good or bad—I want to hear them. You can open an issue on <a href="https://github.com/stevenpate/tbr-fyi-beta/issues" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">GitHub</a> or just reply to any SMS.
				</p>

				<div class="mt-4">
					<p class="font-semibold text-gray-900 mb-2">Specific things that help:</p>
					<ul class="space-y-1 text-sm ml-4">
						<li>• "I stopped using it because..."</li>
						<li>• "This is confusing..."</li>
						<li>• "I wish it did..."</li>
						<li>• "I use it when..."</li>
					</ul>
				</div>

				<div class="mt-4">
					<p class="font-semibold text-gray-900 mb-2">Things that help less:</p>
					<ul class="space-y-1 text-sm text-gray-600 ml-4">
						<li>• "It's cool!" (but why?)</li>
						<li>• "You should add fifty features" (maybe, but which one matters most?)</li>
					</ul>
				</div>
			</div>
		</div>

		<!-- Privacy -->
		<div class="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
			<h2 class="text-2xl font-semibold text-gray-900 mb-4">Privacy</h2>

			<div class="space-y-4 text-gray-700">
				<p>
					TBR.fyi only stores what it needs to work: your phone number (if you use SMS) and the books you add. It doesn't sell your data, scan your contacts, or do anything clever behind the scenes.
				</p>

				<p>
					To delete everything, text STOP or open an issue on <a href="https://github.com/stevenpate/tbr-fyi-beta/issues" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">GitHub</a>.
				</p>
			</div>
		</div>

		<!-- Get Started -->
		<div class="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-xl p-8 text-white">
			<h2 class="text-2xl font-semibold mb-4">Get started</h2>

			<div class="space-y-3 text-blue-50">
				<p>
					If you already have an account, jump back to your list and add a book. If you're new, try adding one right now—by text or directly in the web app—and see if it earns a place in your workflow.
				</p>

				<div class="flex flex-col sm:flex-row gap-3 mt-6">
					<a
						href="/"
						class="inline-flex items-center justify-center px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
					>
						Go to TBR.fyi
					</a>
					<a
						href="https://github.com/stevenpate/tbr-fyi-beta"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-400 transition-colors font-medium"
					>
						<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
							<path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd"></path>
						</svg>
						View on GitHub
					</a>
				</div>
			</div>
		</div>
	</div>
</div>
