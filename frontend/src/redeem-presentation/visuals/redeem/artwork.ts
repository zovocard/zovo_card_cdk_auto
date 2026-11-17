const textures = import.meta.glob('../../assets/redeem/*.webp', {eager:true,query:'?url',import:'default'})
export const redeemArtwork = Object.fromEntries(Object.entries(textures).map(([path,value]) => [path.split('/').pop()!.replace('.webp',''),value]))
