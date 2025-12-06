# BookWyrm & tbr.fyi Integration Research

## BookWyrm Overview

BookWyrm is "a social network for tracking your reading, talking about books, writing reviews, and discovering what to read next." It operates as a federated platform built on ActivityPub, enabling users to participate in interconnected communities rather than a single centralized service.

### Key Features

**Content & Community:**
- Compose reviews and comment on reading progress
- Share book quotes and engage in discussions with other readers
- Track reading history and maintain reading lists

**Federation & Interoperability:**
- Connects with other BookWyrm instances and ActivityPub-compatible services like Mastodon
- Allows cross-platform interaction where users on different servers can engage with each other's content

**Privacy & Control:**
- Users and administrators manage visibility settings for posts
- Communities autonomously choose federation preferences and moderation policies

### Target Audience & Use Cases

BookWyrm serves readers seeking community-driven alternatives to centralized platforms like Goodreads. It appeals to:
- Book clubs wanting dedicated instances
- Niche reading communities (e.g., specific genres or interests)
- Users prioritizing privacy and decentralized control
- Those valuing small, self-governing communities over monolithic services

### Social Reading Experience

Rather than emphasizing book cataloging, BookWyrm prioritizes social interaction—enabling readers to discuss what they're currently reading, share perspectives, and discover recommendations within trusted networks.

## BookWyrm vs tbr.fyi: Complementary Tools

**BookWyrm** is a federated social reading platform (think "Mastodon for books"):
- Reviews, discussions, reading progress sharing
- Community-driven discovery and recommendations
- Privacy-focused alternative to Goodreads
- Rich social features, reading lists, book clubs

**tbr.fyi** is a lightweight SMS book inbox:
- Instant capture via text message
- Personal shelf with basic read/owned status
- Zero social features, minimal UI
- Frictionless entry point

## How BookWyrm Users Would Relate to tbr.fyi

### 1. Capture-to-Consumption Pipeline
- **BookWyrm**: Where you *live* with books (discuss, review, track reading)
- **tbr.fyi**: Where you *capture* book ideas instantly (SMS while browsing, in bookstores, from podcasts)

### 2. Friction Point Solutions
- BookWyrm requires web/app access and intentional engagement
- tbr.fyi solves "I heard about a book but I'm driving/walking/busy" → just text the ISBN

### 3. Integration Opportunity
- tbr.fyi could export to BookWyrm instances (ActivityPub integration?)
- Use tbr.fyi as the "quick inbox" that later syncs to your BookWyrm shelf
- SMS command like "MOVE [ISBN] TO BOOKWYRM" to transfer books

## Why tbr.fyi Appeals to BookWyrm Users

**Active book enthusiasts**: People using BookWyrm care deeply about books and constantly encounter recommendations. They need a frictionless capture tool.

**Privacy-conscious**: Both projects prioritize user control over corporate platforms (federated BookWyrm, SMS-only tbr.fyi with no account required)

**Tool minimalism**: BookWyrm users who chose decentralization over Goodreads likely appreciate tbr.fyi's "one job done well" philosophy

**Friction elimination**: The hardest part of book tracking is *remembering to add* the book. SMS removes that barrier completely.

## Potential Feature Ideas

### Export & Sync
- Export shelf as BookWyrm-compatible format
- SMS command to share book to BookWyrm instance
- Auto-tag books in BookWyrm with "from-tbr-fyi" when imported

### Social Integration
- Display BookWyrm reviews on tbr.fyi shelf pages (federated lookup)
- Link to BookWyrm profile from tbr.fyi shelf
- Cross-post "added to shelf" activity to BookWyrm

### User Experience
- SMS command: "BOOKWYRM [ISBN]" to send directly to connected instance
- Batch export: "Export all unread books to BookWyrm"
- Two-way sync: Mark as read in BookWyrm → updates tbr.fyi

## Technical Considerations

- BookWyrm uses ActivityPub protocol for federation
- API documentation: https://docs.joinbookwyrm.com/
- Would need user authentication/linking between services
- Could start simple: CSV/JSON export for manual import
