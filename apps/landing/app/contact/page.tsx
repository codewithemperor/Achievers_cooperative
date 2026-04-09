"use client";

import { Button, Card, CardBody, Input, Textarea } from "@heroui/react";
import { FormField, SectionHeader } from "@achievers/ui";

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <SectionHeader
        eyebrow="Contact"
        title="Start the conversation"
        description="Use this page as the cooperative’s public contact and demo request form. In a later phase it can connect to the NestJS backend or a CRM endpoint."
      />
      <Card className="mt-12 border border-slate-200 bg-white">
        <CardBody className="p-8">
          <form className="grid gap-6 md:grid-cols-2">
            <FormField label="Full name">
              <Input placeholder="Jane Doe" radius="lg" />
            </FormField>
            <FormField label="Email address">
              <Input placeholder="jane@example.com" radius="lg" type="email" />
            </FormField>
            <FormField label="Organization">
              <Input placeholder="Achievers Cooperative" radius="lg" />
            </FormField>
            <FormField label="Phone number">
              <Input placeholder="+234 800 000 0000" radius="lg" />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="How can we help?">
                <Textarea
                  minRows={6}
                  placeholder="Tell us whether you are interested in the member app, admin operations portal, or a full cooperative digital rollout."
                  radius="lg"
                />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <Button className="bg-[var(--brand-ink)] text-white" radius="full" size="lg">
                Send Inquiry
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </main>
  );
}
