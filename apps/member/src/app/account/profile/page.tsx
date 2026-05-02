"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PencilLine } from "lucide-react";
import api, { uploadMemberImage } from "@/lib/member-api";
import { apiCallWithAlert } from "@/lib/alert";
import { useProfileData } from "@/hooks/use-profile-data";
import { MemberModal } from "@/components/member-modal";
import { TextInput } from "@/components/form-input";

const fallbackProfile = {
  id: "demo",
  email: "member@example.com",
  member: {
    id: "member-demo",
    fullName: "Member",
    phoneNumber: "08000000000",
    membershipNumber: "ACH-000000",
    status: "ACTIVE",
    joinedAt: new Date().toISOString(),
    homeAddress: "",
    stateOfOrigin: "",
    dateOfBirth: new Date().toISOString(),
    occupation: "",
    maritalStatus: "",
    identificationNumber: "",
    identificationType: "",
    avatarUrl: null,
  },
};

const profileSchema = z.object({
  homeAddress: z.string(),
  occupation: z.string(),
  avatarUrl: z.string(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function AccountProfilePage() {
  const profile = useProfileData(fallbackProfile);
  const member = profile.data.member;
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const { control, handleSubmit, reset, setValue } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { homeAddress: "", occupation: "", avatarUrl: "" },
  });

  function openProfileModal() {
    reset({
      homeAddress: member?.homeAddress || "",
      occupation: member?.occupation || "",
      avatarUrl: member?.avatarUrl || "",
    });
    setIsProfileModalOpen(true);
  }

  async function handleProfilePictureUpload(file: File | null) {
    if (!file) return;

    try {
      setUploadingAvatar(true);
      const upload = await uploadMemberImage(file, "member-avatar");
      setValue("avatarUrl", upload.url);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function onSubmitProfile(values: ProfileFormValues) {
    const result = await apiCallWithAlert({
      title: "Profile Update",
      loadingText: "Saving profile...",
      apiCall: () =>
        api.patch("/members/me", {
          homeAddress: values.homeAddress || undefined,
          occupation: values.occupation || undefined,
          avatarUrl: values.avatarUrl || undefined,
        }),
      successTitle: "Profile Updated",
      successText: "Your profile has been saved successfully.",
    });

    if (result) {
      setIsProfileModalOpen(false);
      await profile.refetch();
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-white/92 p-4 shadow-[0_22px_48px_rgba(15,23,42,0.08)] dark:bg-[color:rgba(15,23,42,0.72)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-900)] dark:text-[var(--text-50)]">Profile details</h1>
            <p className="mt-1 text-sm text-[var(--text-400)]">Your key member identity details are stored locally after the first fetch for quicker revisits.</p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-600)] px-4 py-2 text-sm font-semibold text-white"
            onClick={openProfileModal}
            type="button"
          >
            <PencilLine className="h-4 w-4" />
            Edit
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          {[
            { label: "Phone number", value: member?.phoneNumber || "-" },
            { label: "Email", value: profile.data.email || "-" },
            { label: "Home address", value: member?.homeAddress || "-" },
            { label: "Occupation", value: member?.occupation || "-" },
            { label: "State of origin", value: member?.stateOfOrigin || "-" },
            { label: "Marital status", value: member?.maritalStatus || "-" },
          ].map((item) => (
            <div key={item.label} className="rounded-[24px] border border-[var(--background-200)] px-4 py-4 dark:border-white/10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-400)]">{item.label}</p>
              <p className="mt-2 text-sm font-medium text-[var(--text-800)] dark:text-[var(--text-100)]">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <MemberModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title="Edit profile"
        description="Update your address, occupation, and profile picture."
      >
        <form className="grid gap-4" onSubmit={handleSubmit(onSubmitProfile)}>
          <TextInput control={control} name="homeAddress" label="Home address" placeholder="Enter your home address" />
          <TextInput control={control} name="occupation" label="Occupation" placeholder="Enter your occupation" />
          <div className="grid gap-2">
            <label className="text-sm font-medium text-text-700 dark:text-text-200" htmlFor="member-profile-picture">
              Profile picture
            </label>
            <input
              id="member-profile-picture"
              accept="image/*"
              className="min-h-12 rounded-2xl border border-background-200 bg-white px-4 py-3 text-sm text-text-700 outline-none transition-colors focus:border-primary-400 dark:border-background-700 dark:bg-background-900 dark:text-text-300"
              onChange={(event) => void handleProfilePictureUpload(event.target.files?.[0] ?? null)}
              type="file"
            />
          </div>
          <button
            className="min-h-[44px] rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
            disabled={uploadingAvatar}
            type="submit"
          >
            {uploadingAvatar ? "Uploading image..." : "Save profile"}
          </button>
        </form>
      </MemberModal>
    </div>
  );
}
