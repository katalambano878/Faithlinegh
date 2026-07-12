'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  category: string | null;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function MyTicketsPage() {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(true);

  useEffect(() => {
    async function fetchTickets() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoggedIn(false);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/support/tickets?limit=50', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (res.ok) setTickets(json.data || []);
      } catch (err) {
        console.error('Failed to load tickets:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTickets();
  }, []);

  const filteredTickets = selectedFilter === 'all'
    ? tickets
    : tickets.filter(ticket => ticket.status === selectedFilter);

  const countByStatus = (status: string) => tickets.filter(t => t.status === status).length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-[#5B4436]/10 text-[#5B4436]';
      case 'in_progress': return 'bg-[#F4F2F1] text-[#5B4436]';
      case 'waiting_customer': return 'bg-[#5B4436]/10 text-[#5B4436]';
      case 'resolved': return 'bg-gray-100 text-gray-900';
      case 'closed': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
      case 'high': return 'text-[#5B4436]';
      case 'medium': return 'text-[#5B4436]';
      case 'low': return 'text-gray-700';
      default: return 'text-gray-700';
    }
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const filterTabs = [
    { key: 'all', label: `All Tickets (${tickets.length})` },
    { key: 'open', label: `Open (${countByStatus('open')})` },
    { key: 'in_progress', label: `In Progress (${countByStatus('in_progress')})` },
    { key: 'resolved', label: `Resolved (${countByStatus('resolved')})` },
  ];

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">My Support Tickets</h1>
              <p className="text-gray-600">Track and manage your support requests</p>
            </div>
            <Link
              href="/support/ticket"
              className="bg-gray-900 hover:bg-brand-bag-dark text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              <i className="ri-add-line mr-2"></i>
              New Ticket
            </Link>
          </div>

          {loading ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <i className="ri-loader-4-line animate-spin text-3xl text-gray-400"></i>
            </div>
          ) : !loggedIn ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <div className="w-20 h-20 flex items-center justify-center bg-gray-100 rounded-full mx-auto mb-6">
                <i className="ri-user-line text-4xl text-gray-400"></i>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign in to view your tickets</h2>
              <p className="text-gray-600 mb-6">Log in with the email you used when creating your ticket.</p>
              <Link
                href="/auth/login"
                className="inline-block bg-gray-900 hover:bg-brand-bag-dark text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
              >
                Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
                <div className="flex border-b border-gray-200 overflow-x-auto">
                  {filterTabs.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setSelectedFilter(tab.key)}
                      className={`px-6 py-4 font-semibold whitespace-nowrap border-b-2 transition-colors ${
                        selectedFilter === tab.key
                          ? 'border-gray-900 text-gray-900'
                          : 'border-transparent text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredTickets.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                  <div className="w-20 h-20 flex items-center justify-center bg-gray-100 rounded-full mx-auto mb-6">
                    <i className="ri-ticket-line text-4xl text-gray-400"></i>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">No tickets found</h2>
                  <p className="text-gray-600 mb-6">You don't have any support tickets yet</p>
                  <Link
                    href="/support/ticket"
                    className="inline-block bg-gray-900 hover:bg-brand-bag-dark text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
                  >
                    Create Your First Ticket
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="block bg-white rounded-xl shadow-sm p-6 border-2 border-transparent"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-xl font-bold text-gray-900">{ticket.subject}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getStatusColor(ticket.status)}`}>
                              {ticket.status.replace(/_/g, ' ').toUpperCase()}
                            </span>
                          </div>
                          <p className="text-gray-600 mb-3">
                            {ticket.category ? `${ticket.category} • ` : ''}Ticket #{ticket.ticket_number}
                          </p>
                          <div className="flex items-center space-x-6 text-sm text-gray-500">
                            <div className="flex items-center space-x-2">
                              <i className="ri-calendar-line"></i>
                              <span>Created {formatDate(ticket.created_at)}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <i className="ri-time-line"></i>
                              <span>Updated {formatDate(ticket.updated_at)}</span>
                            </div>
                          </div>
                        </div>
                        <div className={`flex items-center space-x-1 font-semibold ${getPriorityColor(ticket.priority)}`}>
                          <i className={`ri-flag-${['urgent', 'high'].includes(ticket.priority) ? 'fill' : 'line'}`}></i>
                          <span className="capitalize">{ticket.priority}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="mt-8 grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="w-12 h-12 flex items-center justify-center bg-[#5B4436]/10 rounded-lg mb-4">
                <i className="ri-time-line text-2xl text-[#5B4436]"></i>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Response Time</h3>
              <p className="text-2xl font-bold text-[#5B4436] mb-1">24 hours</p>
              <p className="text-sm text-gray-600">Average response time</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-lg mb-4">
                <i className="ri-mail-line text-2xl text-gray-900"></i>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Email Updates</h3>
              <p className="text-2xl font-bold text-gray-900 mb-1">Included</p>
              <p className="text-sm text-gray-600">We reply to your email</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="w-12 h-12 flex items-center justify-center bg-[#5B4436]/10 rounded-lg mb-4">
                <i className="ri-customer-service-line text-2xl text-[#5B4436]"></i>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Support Hours</h3>
              <p className="text-2xl font-bold text-[#5B4436] mb-1">Mon–Sat</p>
              <p className="text-sm text-gray-600">9am – 6pm GMT</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
