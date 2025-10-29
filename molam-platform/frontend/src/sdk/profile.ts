export async function getMyProfile() {
    return (await fetch("/api/profile/me")).json();
}

export async function updateMyProfile(patch: Partial<{ display_name: string; bio: string; country_code: string; city: string; }>) {
    return (await fetch("/api/profile/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
    })).json();
}

export async function uploadAvatar(file: File) {
    const { key, url } = await (await fetch("/api/profile/me/avatar/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mime: file.type })
    })).json();

    await fetch(url, { method: "PUT", body: file });
    await fetch("/api/profile/me/avatar/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key })
    });
    return key;
}

export async function listPublicActivity(userId: string) {
    return (await fetch(`/api/profile/${userId}/activity`)).json();
}