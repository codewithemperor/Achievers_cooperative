"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, PencilLine, Upload } from "lucide-react";
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
    identificationPicture: "",
    identificationType: "",
    avatarUrl: null as string | null,
    referrer: null as { id: string; fullName: string; membershipNumber: string } | null,
  },
};

const profileSchema = z.object({
  homeAddress: z.string(),
  occupation: z.string(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function initialsFromName(name?: string) {
  return (name || "M")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-background-200 px-4 py-4 dark:border-background-200">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-400">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-medium text-text-800 dark:text-text-100">
        {value || "-"}
      </p>
    </div>
  );
}

export default function AccountProfilePage() {
  const profile = useProfileData(fallbackProfile);
  const member = profile.data.member;
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isIdentificationModalOpen, setIsIdentificationModalOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingIdentification, setUploadingIdentification] = useState(false);

  const { control, handleSubmit, reset } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { homeAddress: "", occupation: "" },
  });

  function openProfileModal() {
    reset({
      homeAddress: member?.homeAddress || "",
      occupation: member?.occupation || "",
    });
    setIsProfileModalOpen(true);
  }

  async function uploadAvatar(file: File | null) {
    if (!file) return;

    setUploadingAvatar(true);
    const result = await apiCallWithAlert({
      title: "Profile Picture",
      loadingText: "Uploading profile picture...",
      apiCall: async () => {
        const upload = await uploadMemberImage(file, "member-avatar");
        await api.patch("/members/me", { avatarUrl: upload.url });
        return upload.url;
      },
      successTitle: "Profile Picture Updated",
      successText: "Your profile picture has been updated.",
    });
    setUploadingAvatar(false);

    if (result) {
      setIsAvatarModalOpen(false);
      await profile.refetch();
    }
  }

  async function uploadIdentification(file: File | null) {
    if (!file) return;

    setUploadingIdentification(true);
    const result = await apiCallWithAlert({
      title: "Identification Upload",
      loadingText: "Uploading identification document...",
      apiCall: async () => {
        const upload = await uploadMemberImage(file, "member-id");
        await api.patch("/members/me", { identificationPicture: upload.url });
        return upload.url;
      },
      successTitle: "Identification Uploaded",
      successText: "Your identification document has been saved.",
    });
    setUploadingIdentification(false);

    if (result) {
      await profile.refetch();
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
      <section className="rounded-[28px] bg-white/92 p-4 shadow-[0_22px_48px_rgba(15,23,42,0.08)] dark:bg-background-100">
        <div className="flex flex-col items-center gap-4 text-center">
          <button
            className="group relative h-28 w-28 overflow-hidden rounded-[2rem] border border-background-200 bg-background-50 text-2xl font-semibold text-primary-700 dark:border-background-200 dark:bg-background-50"
            onClick={() => setIsAvatarModalOpen(true)}
            type="button"
          >
            {member?.avatarUrl ? (
              <img
                alt={member.fullName}
                className="h-full w-full object-cover"
                src={member.avatarUrl}
              />
            ) : (
              initialsFromName(member?.fullName)
            )}
            <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg">
              <PencilLine className="h-4 w-4" />
            </span>
          </button>

          <div>
            <h1 className="text-xl font-semibold text-text-900 dark:text-text-50">
              {member?.fullName || "Member"}
            </h1>
            <p className="mt-1 text-sm text-text-400">
              {member?.membershipNumber || "-"} | {member?.status || "-"}
            </p>
          </div>

          <button
            className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white"
            onClick={openProfileModal}
            type="button"
          >
            <PencilLine className="h-4 w-4" />
            Edit details
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          {[
            { label: "Full name", value: member?.fullName || "-" },
            { label: "Membership number", value: member?.membershipNumber || "-" },
            { label: "Phone number", value: member?.phoneNumber || "-" },
            { label: "Email", value: profile.data.email || "-" },
            { label: "Home address", value: member?.homeAddress || "-" },
            { label: "Occupation", value: member?.occupation || "-" },
            { label: "State of origin", value: member?.stateOfOrigin || "-" },
            { label: "Date of birth", value: formatDate(member?.dateOfBirth) },
            { label: "Marital status", value: member?.maritalStatus?.replaceAll("_", " ") || "-" },
            {
              label: "Referrer",
              value: member?.referrer
                ? `${member.referrer.fullName} (${member.referrer.membershipNumber})`
                : "No referrer",
            },
            { label: "Identification type", value: member?.identificationType?.replaceAll("_", " ") || "-" },
            { label: "Identification number", value: member?.identificationNumber || "-" },
            { label: "Joined", value: formatDate(member?.joinedAt) },
          ].map((item) => (
            <DetailRow key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </section>

      <section className="rounded-[28px] bg-white/92 p-4 shadow-[0_22px_48px_rgba(15,23,42,0.08)] dark:bg-background-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text-900 dark:text-text-50">
              Identification document
            </h2>
            <p className="mt-1 text-sm text-text-400">
              View or upload the document attached to your profile.
            </p>
          </div>
        </div>

        {member?.identificationPicture ? (
          <button
            className="mt-4 h-48 w-full overflow-hidden rounded-2xl border border-background-200 dark:border-background-200"
            onClick={() => setIsIdentificationModalOpen(true)}
            type="button"
          >
            <img
              alt="Identification document"
              className="h-full w-full object-cover"
              src={member.identificationPicture}
            />
          </button>
        ) : (
          <label className="mt-4 flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-background-300 px-4 py-8 text-center text-sm text-text-400 dark:border-background-200">
            <Upload className="h-6 w-6" />
            <span>
              {uploadingIdentification
                ? "Uploading identification..."
                : "Upload identification document"}
            </span>
            <input
              accept="image/*"
              className="sr-only"
              disabled={uploadingIdentification}
              onChange={(event) =>
                void uploadIdentification(event.target.files?.[0] ?? null)
              }
              type="file"
            />
          </label>
        )}
      </section>

      <MemberModal
        isOpen={isIdentificationModalOpen}
        onClose={() => setIsIdentificationModalOpen(false)}
        title="Identification document"
      >
        {member?.identificationPicture ? (
          <img
            alt="Identification document"
            className="max-h-[70vh] w-full rounded-2xl object-contain"
            src={member.identificationPicture}
          />
        ) : null}
      </MemberModal>

      <MemberModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        title="Edit profile picture"
        description="Upload a clear profile picture for your member account."
      >
        <div className="grid gap-4">
          <div className="mx-auto h-32 w-32 overflow-hidden rounded-[2rem] bg-background-50 dark:bg-background-50">
            {member?.avatarUrl ? (
              <img
                alt={member.fullName}
                className="h-full w-full object-cover"
                src={member.avatarUrl}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-primary-700">
                {initialsFromName(member?.fullName)}
              </div>
            )}
          </div>
          <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90">
            <Camera className="h-4 w-4" />
            {uploadingAvatar ? "Uploading..." : "Choose profile picture"}
            <input
              accept="image/*"
              className="sr-only"
              disabled={uploadingAvatar}
              onChange={(event) =>
                void uploadAvatar(event.target.files?.[0] ?? null)
              }
              type="file"
            />
          </label>
        </div>
      </MemberModal>

      <MemberModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title="Edit profile"
        description="Update your home address and occupation."
      >
        <form className="grid gap-4" onSubmit={handleSubmit(onSubmitProfile)}>
          <TextInput
            control={control}
            name="homeAddress"
            label="Home address"
            placeholder="Enter your home address"
          />
          <TextInput
            control={control}
            name="occupation"
            label="Occupation"
            placeholder="Enter your occupation"
          />
          <button
            className="min-h-11 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
            type="submit"
          >
            Save profile
          </button>
        </form>
      </MemberModal>
    </div>
  );
}
