import React from "react";

export function ProfileCard({ p, badges }: { p: any; badges: any[] }) {
    return (
        <div className="rounded-3xl shadow bg-white overflow-hidden">
            <div className="h-28 bg-gray-100" style={{ backgroundImage: `url(/media/${p.banner_key})`, backgroundSize: 'cover' }} />
            <div className="p-5 -mt-10 flex items-center gap-4">
                <img src={`/media/${p.avatar_key}`} className="w-20 h-20 rounded-2xl object-cover border-4 border-white" alt="" />
                <div className="flex-1">
                    <div className="text-xl font-semibold">{p.display_name}</div>
                    <div className="text-gray-500 text-sm">{p.country_code} • {p.city}</div>
                </div>
                <div className="flex gap-2">
                    {badges.map(b => (
                        <img key={b.code} src={`/media/${b.icon_key}`} className="w-6 h-6" title={b.name} />
                    ))}
                </div>
            </div>
        </div>
    );
}