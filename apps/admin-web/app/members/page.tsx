"use client";

import { Card, CardBody, Input, Button, Chip, Select, SelectItem } from "@heroui/react";
import { FormField } from "@achievers/ui";
import { useState } from "react";

const mockMembers = [
  { id: "1", name: "Adaeze Okonkwo", email: "adaeze@achievers.com", phone: "+234 801 234 5678", memberNo: "ACH-000001", status: "ACTIVE", joinedAt: "Jan 15, 2026", wallet: "₦150,000" },
  { id: "2", name: "Chidi Eze", email: "chidi@achievers.com", phone: "+234 802 345 6789", memberNo: "ACH-000002", status: "ACTIVE", joinedAt: "Feb 3, 2026", wallet: "₦250,000" },
  { id: "3", name: "Funke Adeyemi", email: "funke@achievers.com", phone: "+234 803 456 7890", memberNo: "ACH-000003", status: "PENDING", joinedAt: "Mar 20, 2026", wallet: "₦0" },
  { id: "4", name: "Emeka Nwosu", email: "emeka@achievers.com", phone: "+234 804 567 8901", memberNo: "ACH-000004", status: "ACTIVE", joinedAt: "Feb 18, 2026", wallet: "₦75,000" },
  { id: "5", name: "Blessing Obi", email: "blessing@achievers.com", phone: "+234 805 678 9012", memberNo: "ACH-000005", status: "SUSPENDED", joinedAt: "Dec 5, 2025", wallet: "₦0" },
  { id: "6", name: "Yusuf Abdullahi", email: "yusuf@achievers.com", phone: "+234 806 789 0123", memberNo: "ACH-000006", status: "ACTIVE", joinedAt: "Mar 1, 2026", wallet: "₦320,000" },
];

const statusColor = {
  ACTIVE: "success" as const,
  PENDING: "warning" as const,
  SUSPENDED: "danger" as const,
};

export default function MembersPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = mockMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.memberNo.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--brand-ink)]">Members</h1>
          <p className="mt-1 text-sm text-slate-500">Manage cooperative members and their accounts</p>
        </div>
        <Button
          className="bg-[var(--brand-ink)] text-white"
          radius="lg"
          size="sm"
          onPress={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? "Cancel" : "+ Add Member"}
        </Button>
      </div>

      {/* Add Member Form */}
      {showAddForm && (
        <Card className="mb-6 border border-slate-200 bg-white">
          <CardBody className="p-5">
            <h3 className="text-base font-semibold text-[var(--brand-ink)]">Add New Member</h3>
            <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
              <FormField label="Full Name">
                <Input placeholder="Enter full name" variant="bordered" radius="lg" />
              </FormField>
              <FormField label="Email Address">
                <Input type="email" placeholder="Enter email" variant="bordered" radius="lg" />
              </FormField>
              <FormField label="Phone Number">
                <Input type="tel" placeholder="Enter phone number" variant="bordered" radius="lg" />
              </FormField>
              <FormField label="Membership Status">
                <Select placeholder="Select status" variant="bordered" radius="lg">
                  <SelectItem key="PENDING">Pending</SelectItem>
                  <SelectItem key="ACTIVE">Active</SelectItem>
                  <SelectItem key="SUSPENDED">Suspended</SelectItem>
                </Select>
              </FormField>
              <div className="sm:col-span-2">
                <Button type="submit" className="bg-[var(--brand-ink)] text-white" radius="lg">
                  Create Member
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder="Search by name, member number, or email..."
          variant="bordered"
          radius="lg"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          startContent={
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          }
        />
      </div>

      {/* Members Table */}
      <Card className="border border-slate-200 bg-white">
        <CardBody className="p-0">
          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Member</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Contact</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Status</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Wallet</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-500">Joined</th>
                  <th className="px-5 py-3 text-right font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => (
                  <tr key={member.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-3">
                      <div>
                        <p className="font-medium text-[var(--brand-ink)]">{member.name}</p>
                        <p className="text-xs text-slate-400">{member.memberNo}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-slate-600">{member.email}</p>
                      <p className="text-xs text-slate-400">{member.phone}</p>
                    </td>
                    <td className="px-5 py-3">
                      <Chip size="sm" color={statusColor[member.status as keyof typeof statusColor]} variant="flat">
                        {member.status}
                      </Chip>
                    </td>
                    <td className="px-5 py-3 font-medium">{member.wallet}</td>
                    <td className="px-5 py-3 text-slate-500">{member.joinedAt}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50">
                          View
                        </button>
                        {member.status === "PENDING" && (
                          <button className="rounded-lg bg-green-50 px-3 py-1 text-xs font-medium text-green-600 hover:bg-green-100">
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-2 p-4 md:hidden">
            {filtered.map((member) => (
              <div key={member.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--brand-ink)]">{member.name}</p>
                    <p className="text-xs text-slate-400">{member.memberNo}</p>
                  </div>
                  <Chip size="sm" color={statusColor[member.status as keyof typeof statusColor]} variant="flat">
                    {member.status}
                  </Chip>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-400">Email: </span><span className="text-slate-600">{member.email}</span></div>
                  <div><span className="text-slate-400">Wallet: </span><span className="font-medium">{member.wallet}</span></div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-500">View</button>
                  {member.status === "PENDING" && (
                    <button className="flex-1 rounded-lg bg-green-50 py-2 text-xs font-medium text-green-600">Activate</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
