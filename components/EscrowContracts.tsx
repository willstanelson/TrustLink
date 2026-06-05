'use client';
import { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';

export default function EscrowContracts() {
  const [filterType, setFilterType] = useState('all');
  const [filterNetwork, setFilterNetwork] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  // Search Debounce (220ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim().toLowerCase());
      setCurrentPage(1); // Reset to page 1 on search
    }, 220);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Synchronous State Handlers (Eliminates useEffect double-renders)
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value;
    setFilterType(newType);
    if (newType === 'bank_transfer' || newType === 'giftcard') {
      setFilterNetwork('all');
    }
    setCurrentPage(1);
  };

  const handleNetworkChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterNetwork(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterStatus(e.target.value);
    setCurrentPage(1);
  };

  // Normalized Dummy Data
  const rawContracts = useMemo(() => [
    { id: 'ESC-8992', buyer: '0x71C...3A90', type: 'crypto', network: 'bsc', amount: '$450.00', status: 'active' },
    { id: 'ESC-8991', buyer: 'Michael O.', type: 'bank_transfer', network: 'fiat', amount: '₦250,000', status: 'completed' },
    { id: 'ESC-8990', buyer: '0x11B...99F1', type: 'giftcard', network: 'fiat', amount: '$100.00', status: 'disputed' },
    { id: 'ESC-8989', buyer: '0x44A...1B22', type: 'crypto', network: 'ethereum', amount: '$1,200.00', status: 'completed' },
    { id: 'ESC-8988', buyer: 'Sarah J.', type: 'bank_transfer', network: 'fiat', amount: '₦150,000', status: 'active' },
    { id: 'ESC-8987', buyer: '0x99D...4C33', type: 'crypto', network: 'polygon', amount: '$300.00', status: 'active' },
    { id: 'ESC-8986', buyer: 'David K.', type: 'giftcard', network: 'fiat', amount: '$50.00', status: 'completed' },
    { id: 'ESC-8985', buyer: '0x22F...8E77', type: 'crypto', network: 'tron', amount: '$800.00', status: 'active' },
  ], []);

  // Chained Filtering Logic
  const filteredContracts = useMemo(() => {
    return rawContracts.filter(contract => {
      const matchType = filterType === 'all' || contract.type === filterType;
      const matchNetwork = filterNetwork === 'all' || contract.network === filterNetwork;
      const matchStatus = filterStatus === 'all' || contract.status === filterStatus;
      const matchSearch = debouncedSearch === '' || 
                          contract.id.toLowerCase().includes(debouncedSearch) || 
                          contract.buyer.toLowerCase().includes(debouncedSearch);
      
      return matchType && matchNetwork && matchStatus && matchSearch;
    });
  }, [rawContracts, filterType, filterNetwork, filterStatus, debouncedSearch]);

  // Dynamic Stats (Based on filtered results, not raw data)
  const stats = useMemo(() => ({
    total: filteredContracts.length,
    active: filteredContracts.filter(c => c.status === 'active').length,
    completed: filteredContracts.filter(c => c.status === 'completed').length,
    disputed: filteredContracts.filter(c => c.status === 'disputed').length,
  }), [filteredContracts]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredContracts.length / ITEMS_PER_PAGE);
  const paginatedContracts = filteredContracts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE, 
    currentPage * ITEMS_PER_PAGE
  );
  
  // Safe Pagination Display Values
  const displayStart = filteredContracts.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const displayEnd = Math.min(currentPage * ITEMS_PER_PAGE, filteredContracts.length);

  // Secure Action Handler with fixed regex
  const handleViewContract = (rawId: string) => {
    // Strips out anything that isn't alphanumeric or a hyphen (case-insensitive)
    const safeId = rawId.replace(/[^A-Z0-9\-]/gi, '');
    console.log(`Navigating to secure contract view: ${safeId}`);
    // router.push(`/trade/${safeId}`);
  };

  return (
    <div className="space-y-6">
      {/* Screen Reader Live Region for A11y */}
      <div aria-live="polite" className="sr-only" id="results-announce">
        {filteredContracts.length} contracts found.
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white">Escrow Contracts</h1>
        <p className="text-[#aaaaaa] text-sm mt-1">Manage and track your active service milestones.</p>
      </div>

      {/* Dynamic Filtered Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Orders', value: stats.total, color: 'text-white' },
          { label: 'Active Escrows', value: stats.active, color: 'text-blue-400' },
          { label: 'Completed', value: stats.completed, color: 'text-emerald-400' },
          { label: 'Disputed', value: stats.disputed, color: 'text-red-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#1e1f26] border border-[#333333] p-4 rounded-xl">
            <p className="text-[#aaaaaa] text-xs font-bold uppercase tracking-wider mb-1">{stat.label}</p>
            <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Advanced Filtering & Search */}
      <div className="flex flex-col xl:flex-row justify-between items-center bg-[#1e1f26] p-4 rounded-xl border border-[#333333] gap-4">
        
        <div className="relative w-full xl:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#aaaaaa]" />
          <input 
            type="search" 
            maxLength={100}
            autoComplete="off"
            spellCheck="false"
            aria-label="Search contracts by ID or buyer"
            placeholder="Search contract ID or buyer..." 
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-[#0b0f19] border border-[#333333] text-white text-sm rounded-lg pl-10 pr-4 py-2.5 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-[#555555]"
          />
        </div>

        <div className="flex flex-wrap gap-3 w-full xl:w-auto">
          {/* Status Filter */}
          <div className="relative w-full sm:w-auto min-w-[140px]">
            <select 
              aria-label="Filter by Status"
              value={filterStatus}
              onChange={handleStatusChange}
              className="w-full bg-[#0b0f19] border border-[#333333] text-white text-sm rounded-lg pl-4 pr-10 py-2.5 focus:border-emerald-500 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="disputed">Disputed</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#aaaaaa] pointer-events-none" />
          </div>

          {/* Type Filter */}
          <div className="relative w-full sm:w-auto min-w-[150px]">
            <select 
              aria-label="Filter by Type"
              value={filterType}
              onChange={handleTypeChange}
              className="w-full bg-[#0b0f19] border border-[#333333] text-white text-sm rounded-lg pl-4 pr-10 py-2.5 focus:border-emerald-500 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="crypto">Crypto Escrow</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="giftcard">Giftcards</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#aaaaaa] pointer-events-none" />
          </div>

          {/* Network Filter */}
          <div className="relative w-full sm:w-auto min-w-[150px]">
            <select 
              aria-label="Filter by Network"
              value={filterNetwork}
              onChange={handleNetworkChange}
              disabled={filterType === 'bank_transfer' || filterType === 'giftcard'}
              className="w-full bg-[#0b0f19] border border-[#333333] text-white text-sm rounded-lg pl-4 pr-10 py-2.5 focus:border-emerald-500 focus:outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="all">All Networks</option>
              <option value="ethereum">Ethereum</option>
              <option value="bsc">Binance Smart Chain</option>
              <option value="polygon">Polygon</option>
              <option value="tron">TRON</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#aaaaaa] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Contracts Table */}
      <div className="bg-[#1e1f26] border border-[#333333] rounded-xl overflow-hidden flex flex-col min-h-[400px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm table-fixed" role="grid">
            <thead className="bg-[#0b0f19] border-b border-[#333333] text-[#aaaaaa]">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium w-[15%]">Contract ID</th>
                <th scope="col" className="px-6 py-4 font-medium w-[20%]">Buyer</th>
                <th scope="col" className="px-6 py-4 font-medium w-[15%]">Type</th>
                <th scope="col" className="px-6 py-4 font-medium w-[15%]">Network</th>
                <th scope="col" className="px-6 py-4 font-medium w-[15%]">Amount</th>
                <th scope="col" className="px-6 py-4 font-medium w-[10%]">Status</th>
                <th scope="col" className="px-6 py-4 font-medium w-[10%] text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333333]">
              {paginatedContracts.length > 0 ? (
                paginatedContracts.map((contract) => (
                  <tr key={contract.id} className="hover:bg-[#0b0f19]/50 transition-colors">
                    {/* Native JSX automatically safely creates TextNodes, preventing XSS */}
                    <td className="px-6 py-4 font-mono text-white truncate">{contract.id}</td>
                    <td className="px-6 py-4 text-white truncate">{contract.buyer}</td>
                    <td className="px-6 py-4 truncate">
                      <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider">
                        {contract.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#aaaaaa] font-mono text-xs uppercase truncate">
                      {contract.network}
                    </td>
                    <td className="px-6 py-4 text-white font-medium truncate">
                      {contract.amount}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                        contract.status === 'active' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        contract.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {contract.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleViewContract(contract.id)}
                        className="text-emerald-400 hover:text-emerald-300 font-medium text-sm transition-colors focus:outline-none focus:underline"
                        aria-label={`View contract ${contract.id}`}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Inbox className="w-10 h-10 text-[#444444]" />
                      <p className="text-[#aaaaaa] font-medium text-base">0 results found</p>
                      <p className="text-[#666666] text-sm">Adjust your filters or search query to find what you're looking for.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="bg-[#0b0f19] border-t border-[#333333] px-6 py-4 flex items-center justify-between">
          <span className="text-[#aaaaaa] text-sm">
            Showing <span className="text-white font-medium">{displayStart}</span> to <span className="text-white font-medium">{displayEnd}</span> of <span className="text-white font-medium">{filteredContracts.length}</span> entries
          </span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || filteredContracts.length === 0}
              aria-label="Previous page"
              className="p-1.5 rounded bg-[#1e1f26] border border-[#333333] text-[#aaaaaa] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || filteredContracts.length === 0}
              aria-label="Next page"
              className="p-1.5 rounded bg-[#1e1f26] border border-[#333333] text-[#aaaaaa] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}