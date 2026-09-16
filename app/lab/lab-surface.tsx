"use client";

import { Float, OrbitControls } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { m } from "motion/react";

import { FunnelTrendChart } from "@/components/charts/funnel-trend-chart";
import { GameIcon, ICON, RANK_ICON, STAGE_ICON } from "@/components/icons";
import { SceneEnvironment } from "@/components/three/environment";
import { ScenePhysics } from "@/components/three/physics";
import { Scene } from "@/components/three/scene";
import { SceneText3D } from "@/components/three/text";
import { useReduceMotion } from "@/components/motion/motion-provider";
import { STAGE, TEXT } from "@/lib/design/tokens";
import { modelPath } from "@/lib/three/assets";
import { useModel } from "@/lib/three/loaders";

const TREND = [
  { label: "Wk 1", APL: 4, APD: 1, RE: 0 },
  { label: "Wk 2", APL: 9, APD: 3, RE: 1 },
  { label: "Wk 3", APL: 14, APD: 6, RE: 2 },
  { label: "Wk 4", APL: 21, APD: 9, RE: 5 },
  { label: "Wk 5", APL: 26, APD: 13, RE: 8 },
];

// Draco-compressed by `npm run assets:models`, decoded by the worker three builds
// from a blob URL, using the decoder in public/draco. If this renders, the whole
// asset chain is intact under the CSP.
function CompressedModel() {
  const { scene } = useModel(modelPath("suzi"));
  return <primitive object={scene} scale={1.1} position={[-1.9, 0, 0]} />;
}

function StageTower() {
  return (
    <group position={[1.6, -0.9, 0]}>
      {(["APL", "APD", "RE"] as const).map((stage, index) => (
        <RigidBody key={stage} colliders="cuboid" position={[0, 1.2 + index * 0.7, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.9, 0.45, 0.9]} />
            <meshStandardMaterial color={STAGE[stage]} roughness={0.35} metalness={0.1} />
          </mesh>
        </RigidBody>
      ))}
      <CuboidCollider args={[3, 0.1, 3]} position={[0, 0.4, 0]} />
    </group>
  );
}

export function LabSurface() {
  const reduceMotion = useReduceMotion();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header>
        <h1 className="font-[family-name:var(--face-display)] text-2xl">Visual stack lab</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Development only. The “reduce motion” switch is currently{" "}
          <strong>{reduceMotion ? "on" : "off"}</strong> — every animation, the
          physics simulation and the canvas frame loop follow it.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ink-secondary">
          three.js · drei · Rapier · Draco · Poly Haven HDRI
        </h2>
        <Scene
          className="h-80 w-full overflow-hidden rounded-xl"
          label="A compressed 3D model beside three stacked blocks, one per funnel stage."
          fallback={
            <ul className="flex gap-4 rounded-xl bg-surface-raised p-4 text-sm text-ink-secondary">
              {(["APL", "APD", "RE"] as const).map((stage) => (
                <li key={stage} className="flex items-center gap-2">
                  <GameIcon icon={STAGE_ICON[stage]!} decorative className="size-5" />
                  {stage}
                </li>
              ))}
            </ul>
          }
        >
          <SceneEnvironment environment="city" />
          <ambientLight intensity={0.4} />
          <directionalLight position={[4, 6, 3]} intensity={1.6} />
          <Float speed={reduceMotion ? 0 : 1.4} floatIntensity={reduceMotion ? 0 : 0.6}>
            <CompressedModel />
          </Float>
          <SceneText3D size={0.45} height={0.1} position={[-2.6, 1.9, 0]}>
            XP
            <meshStandardMaterial color={TEXT.primary} />
          </SceneText3D>
          <ScenePhysics>
            <StageTower />
          </ScenePhysics>
          <OrbitControls enablePan={false} enableZoom={false} makeDefault />
        </Scene>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ink-secondary">Recharts</h2>
        <FunnelTrendChart data={TREND} title="Funnel trend, current display window" />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ink-secondary">Motion · Game Icons</h2>
        <m.ul
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, staggerChildren: 0.06 }}
          className="flex flex-wrap gap-4 rounded-xl bg-surface-raised p-4"
        >
          {[
            { icon: STAGE_ICON.APL!, label: "Application" },
            { icon: STAGE_ICON.APD!, label: "Approved" },
            { icon: STAGE_ICON.RE!, label: "Realized" },
            { icon: STAGE_ICON.APD_BROKEN!, label: "Broken" },
            { icon: RANK_ICON[1], label: "First" },
            { icon: ICON.reward, label: "Reward" },
            { icon: ICON.pace, label: "Pace" },
            { icon: ICON.windowClosing, label: "Window closing" },
          ].map(({ icon, label }) => (
            <m.li
              key={label}
              className="flex w-24 flex-col items-center gap-1 text-center text-xs text-ink-muted"
            >
              <GameIcon icon={icon} decorative className="size-8 text-ink-secondary" />
              {label}
            </m.li>
          ))}
        </m.ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ink-secondary">Typography</h2>
        <div className="flex flex-col gap-1 rounded-xl bg-surface-raised p-4">
          <p className="font-[family-name:var(--face-display)] text-2xl text-ink">Display face</p>
          <p className="text-base text-ink-secondary">Interface face, the body default</p>
          <p className="tabular text-3xl text-ink">1 234 567 890</p>
          <p className="font-[family-name:var(--face-mono)] text-sm text-ink-muted">
            Monospace face
          </p>
        </div>
      </section>
    </main>
  );
}
