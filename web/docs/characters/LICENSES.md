# Character model licences

All character models currently used by AETHERIA are free **VRoid Project sample avatars** (VRM 0.x, author
"VRoidプロジェクト" / pixiv VRoid Project), obtained via the OpenGameArt collection **"VRoid Studio CC0 models"**.
Textures were downscaled to 1024 px by the orchestrator; nothing else was modified in the files.
The licence fields below are copied from each file's embedded `VRM.meta` block (checked 2026-11-08).

| Game id | File | Embedded title (original name) | Embedded licence | Permissions in the file |
|---|---|---|---|---|
| kael  | `assets_src/vroid/kael.vrm`  | 桜田 史利矢 (Sakurada Fumiriya) | Other: VRoid Hub licence v1 | everyone may use, commercial use allowed (personal and corporate), modification allowed, redistribution allowed, credit not required, violent and sexual expression allowed |
| lyra  | `assets_src/vroid/lyra.vrm`  | ヴィータ (Vita, VRoid sample avatar) | Other: VRoid Hub licence v1 | same as above |
| maren | `assets_src/vroid/maren.vrm` | 千駄ヶ谷篠 (Sendagaya Shino) | Other: VRoid Hub licence v1 | same as above |
| ostin | `assets_src/vroid/ostin.vrm` | ヴィクトリア・ルービン (Victoria Rubin, VRoid sample avatar) | Other: VRoid Hub licence v1 | same as above |
| toma  | `assets_src/vroid/toma.vrm`  | 千駄ヶ谷渋 (Sendagaya Shibu) | Other: VRoid Hub licence v1 | same as above |
| wenna | `assets_src/vroid/wenna.vrm` | ビビ (Bibi, VRoid sample avatar) | Other: VRoid Hub licence v1 | same as above |
| hesk  | `assets_src/vroid/hesk.vrm`  | Base_Male | **CC0** | same as above |
| veyra | `assets_src/vroid/veyra.vrm` | AvatarSample_D | **CC0** | same as above |

VRoid Hub licence URL embedded in every file (`otherLicenseUrl` / `otherPermissionUrl`):
`https://hub.vroid.com/license?allowed_to_use_user=everyone&characterization_allowed_user=everyone&corporate_commercial_use=allow&credit=unnecessary&modification=allow&personal_commercial_use=profit&redistribution=allow&sexual_expression=allow&version=1&violent_expression=allow`

Notes
* These are generic sample avatars, used as stand-ins for the AETHERIA cast. The orchestrator's note called four of them
  AvatarSample_D/E/F/G; the embedded titles are the sample characters' names, listed above.
  The original AETHERIA character designs are in this folder as per-character sheets (`kael.md` and the rest, in Spanish).
  Replacing a stand-in only takes dropping a new `<id>.vrm` into `assets_src/vroid/`.
* Credit is not required, but we credit "VRoid Project (pixiv)" in the game credits anyway.
* Animations (`assets_src/mixamo/*.fbx`, retargeted to `public/assets/anims/*.json`) come from the orchestrator's
  animation pack. Their licence is tracked by the orchestrator, not in this file.
