import React, { useState } from 'react';
import { MapPin, Package, Clock, MoreVertical, Copy, Barcode } from 'lucide-react';

const BookCard = ({ showBookstoreInfo = true }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyISBN = () => {
    navigator.clipboard.writeText('9780547928227');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Header with title and actions */}
      <div className="p-6 pb-4">
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight pr-4">
            The Hobbit, Or, There and Back Again
          </h1>
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="text-gray-400 hover:text-gray-600 p-1 -mt-1"
          >
            <MoreVertical size={20} />
          </button>
        </div>
        
        <p className="text-lg text-gray-700 mb-1">J. R. R. Tolkien</p>
        <p className="text-sm text-gray-500">Mariner Books (2012)</p>
        
        <button className="text-blue-600 text-sm font-medium mt-3 hover:text-blue-700">
          ▸ Show description
        </button>
      </div>

      {/* Status badges */}
      <div className="px-6 pb-4">
        <div className="flex gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Unread
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
            Not Owned
          </span>
        </div>
      </div>

      {/* Bookstore availability - only shown when data available */}
      {showBookstoreInfo && (
        <div className="mx-6 mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <MapPin size={18} className="text-emerald-700" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-emerald-900">
                  Powell's Books Downtown
                </p>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-600 text-white">
                  In Stock
                </span>
              </div>
              <p className="text-xs text-emerald-700">3 copies available • Orange Room</p>
              <button className="text-xs text-emerald-700 font-medium mt-2 hover:text-emerald-800 underline">
                Get directions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes section */}
      <div className="px-6 pb-4">
        <textarea 
          placeholder="Add note..."
          className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows="2"
        />
      </div>

      {/* Metadata footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Package size={14} />
              On 1 shelf
            </span>
            <span className="flex items-center gap-1">
              <Clock size={14} />
              Added 11/1/2025
            </span>
          </div>
          <button 
            onClick={() => setShowBarcode(!showBarcode)}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
          >
            <Barcode size={16} />
            {showBarcode ? 'Hide' : 'Show'} barcode
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400 font-mono">
            ISBN: 9780547928227
          </div>
          <button 
            onClick={handleCopyISBN}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
          >
            <Copy size={12} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Barcode display - expandable */}
      {showBarcode && (
        <div className="px-6 py-6 bg-white border-t border-gray-100">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-3">Scan at bookstore or library</p>
            {/* Placeholder barcode - in real app would be actual barcode */}
            <div className="inline-block bg-white border-2 border-gray-300 rounded-lg p-4">
              <svg width="200" height="80" viewBox="0 0 200 80">
                {/* Simple barcode representation */}
                <rect x="10" y="10" width="3" height="60" fill="black"/>
                <rect x="16" y="10" width="2" height="60" fill="black"/>
                <rect x="22" y="10" width="4" height="60" fill="black"/>
                <rect x="30" y="10" width="2" height="60" fill="black"/>
                <rect x="35" y="10" width="3" height="60" fill="black"/>
                <rect x="42" y="10" width="2" height="60" fill="black"/>
                <rect x="48" y="10" width="5" height="60" fill="black"/>
                <rect x="57" y="10" width="2" height="60" fill="black"/>
                <rect x="63" y="10" width="3" height="60" fill="black"/>
                <rect x="70" y="10" width="2" height="60" fill="black"/>
                <rect x="76" y="10" width="4" height="60" fill="black"/>
                <rect x="84" y="10" width="2" height="60" fill="black"/>
                <rect x="90" y="10" width="3" height="60" fill="black"/>
                <rect x="97" y="10" width="2" height="60" fill="black"/>
                <rect x="103" y="10" width="5" height="60" fill="black"/>
                <rect x="112" y="10" width="2" height="60" fill="black"/>
                <rect x="118" y="10" width="3" height="60" fill="black"/>
                <rect x="125" y="10" width="2" height="60" fill="black"/>
                <rect x="131" y="10" width="4" height="60" fill="black"/>
                <rect x="139" y="10" width="2" height="60" fill="black"/>
                <rect x="145" y="10" width="3" height="60" fill="black"/>
                <rect x="152" y="10" width="2" height="60" fill="black"/>
                <rect x="158" y="10" width="5" height="60" fill="black"/>
                <rect x="167" y="10" width="2" height="60" fill="black"/>
                <rect x="173" y="10" width="3" height="60" fill="black"/>
                <rect x="180" y="10" width="2" height="60" fill="black"/>
              </svg>
              <p className="text-xs font-mono text-gray-600 mt-2">9780547928227</p>
            </div>
          </div>
        </div>
      )}

      {/* Action menu */}
      <div className="px-6 py-3 border-t border-gray-100">
        <button className="text-sm text-red-600 hover:text-red-700 font-medium">
          Remove from shelf
        </button>
      </div>

      {/* Dropdown menu overlay */}
      {showMenu && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-6 top-16 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20 w-56">
            <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3">
              <span>📖</span>
              <span>Mark as read</span>
            </button>
            <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3">
              <span>📦</span>
              <span>Mark as owned</span>
            </button>
            <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3">
              <span>📚</span>
              <span>Add to another shelf</span>
            </button>
            <div className="border-t border-gray-100 my-1"></div>
            <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3">
              <span>✏️</span>
              <span>Edit book details</span>
            </button>
            <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3">
              <span>↗️</span>
              <span>Share book</span>
            </button>
            <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3">
              <span>🔍</span>
              <span>View full details</span>
            </button>
            <div className="border-t border-gray-100 my-1"></div>
            <button className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3">
              <span>🗑️</span>
              <span>Remove from shelf</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// Version with barcode pre-expanded for demo
const BarcodeExpandedCard = () => {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyISBN = () => {
    navigator.clipboard.writeText('9780547928227');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg overflow-hidden relative">
      <div className="p-6 pb-4">
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight pr-4">
            The Hobbit, Or, There and Back Again
          </h1>
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="text-gray-400 hover:text-gray-600 p-1 -mt-1"
          >
            <MoreVertical size={20} />
          </button>
        </div>
        
        <p className="text-lg text-gray-700 mb-1">J. R. R. Tolkien</p>
        <p className="text-sm text-gray-500">Mariner Books (2012)</p>
        
        <button className="text-blue-600 text-sm font-medium mt-3 hover:text-blue-700">
          ▸ Show description
        </button>
      </div>

      <div className="px-6 pb-4">
        <div className="flex gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Unread
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
            Not Owned
          </span>
        </div>
      </div>

      <div className="px-6 pb-4">
        <textarea 
          placeholder="Add note..."
          className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows="2"
        />
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Package size={14} />
              On 1 shelf
            </span>
            <span className="flex items-center gap-1">
              <Clock size={14} />
              Added 11/1/2025
            </span>
          </div>
          <button 
            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
          >
            <Barcode size={16} />
            Hide barcode
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400 font-mono">
            ISBN: 9780547928227
          </div>
          <button 
            onClick={handleCopyISBN}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
          >
            <Copy size={12} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Barcode display - expanded */}
      <div className="px-6 py-6 bg-white border-t border-gray-100">
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-3">Scan at bookstore or library</p>
          <div className="inline-block bg-white border-2 border-gray-300 rounded-lg p-4">
            <svg width="200" height="80" viewBox="0 0 200 80">
              <rect x="10" y="10" width="3" height="60" fill="black"/>
              <rect x="16" y="10" width="2" height="60" fill="black"/>
              <rect x="22" y="10" width="4" height="60" fill="black"/>
              <rect x="30" y="10" width="2" height="60" fill="black"/>
              <rect x="35" y="10" width="3" height="60" fill="black"/>
              <rect x="42" y="10" width="2" height="60" fill="black"/>
              <rect x="48" y="10" width="5" height="60" fill="black"/>
              <rect x="57" y="10" width="2" height="60" fill="black"/>
              <rect x="63" y="10" width="3" height="60" fill="black"/>
              <rect x="70" y="10" width="2" height="60" fill="black"/>
              <rect x="76" y="10" width="4" height="60" fill="black"/>
              <rect x="84" y="10" width="2" height="60" fill="black"/>
              <rect x="90" y="10" width="3" height="60" fill="black"/>
              <rect x="97" y="10" width="2" height="60" fill="black"/>
              <rect x="103" y="10" width="5" height="60" fill="black"/>
              <rect x="112" y="10" width="2" height="60" fill="black"/>
              <rect x="118" y="10" width="3" height="60" fill="black"/>
              <rect x="125" y="10" width="2" height="60" fill="black"/>
              <rect x="131" y="10" width="4" height="60" fill="black"/>
              <rect x="139" y="10" width="2" height="60" fill="black"/>
              <rect x="145" y="10" width="3" height="60" fill="black"/>
              <rect x="152" y="10" width="2" height="60" fill="black"/>
              <rect x="158" y="10" width="5" height="60" fill="black"/>
              <rect x="167" y="10" width="2" height="60" fill="black"/>
              <rect x="173" y="10" width="3" height="60" fill="black"/>
              <rect x="180" y="10" width="2" height="60" fill="black"/>
            </svg>
            <p className="text-xs font-mono text-gray-600 mt-2">9780547928227</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-3 border-t border-gray-100">
        <button className="text-sm text-red-600 hover:text-red-700 font-medium">
          Remove from shelf
        </button>
      </div>
    </div>
  );
};

// Demo component showing both states
export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Book Card Design Comparison
        </h1>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-4 text-center">
              With Bookstore Info
            </h2>
            <BookCard showBookstoreInfo={true} />
          </div>
          
          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-4 text-center">
              Without Bookstore Info
            </h2>
            <BookCard showBookstoreInfo={false} />
          </div>
          
          <div className="md:col-span-2 lg:col-span-1">
            <h2 className="text-lg font-semibold text-gray-700 mb-4 text-center">
              With Barcode Expanded
            </h2>
            <BarcodeExpandedCard />
          </div>
        </div>

        <div className="mt-12 bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Design Improvements</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Better hierarchy:</strong> Title and author are prominent, metadata is subtle</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Softer action buttons:</strong> Destructive "remove" action is less prominent</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Refined status badges:</strong> Smaller, color-coded, with icons</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Bookstore info integration:</strong> Prominent when available, seamless when absent</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Grouped metadata:</strong> All technical details in a unified footer</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>ISBN utilities:</strong> Quick copy button + expandable barcode for in-store scanning</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Consistent spacing:</strong> 4px base grid with clear visual sections</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Kebab menu actions:</strong> Mark as read/owned, add to shelf, edit, share, view details, remove</span>
            </li>
          </ul>
          
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-3">Design Rationale</h4>
            
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <strong className="text-gray-900">Barcode Placement:</strong> Located in the metadata footer because it's closely related to the ISBN. The expandable design keeps the card compact while making the barcode large enough to scan when needed.
              </div>
              
              <div>
                <strong className="text-gray-900">Kebab Menu Contents:</strong>
                <ul className="mt-2 ml-4 space-y-1">
                  <li>• <strong>Quick status changes</strong> (read, owned) - most frequent actions</li>
                  <li>• <strong>Shelf management</strong> - add to other shelves</li>
                  <li>• <strong>Secondary actions</strong> - edit, share, view full details</li>
                  <li>• <strong>Destructive action</strong> - remove (separated at bottom)</li>
                </ul>
              </div>
              
              <div>
                <strong className="text-gray-900">Why not in kebab menu:</strong> The "Copy ISBN" and "Show barcode" actions are specific to the ISBN context, so placing them directly next to the ISBN makes them more discoverable and logical.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
