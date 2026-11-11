import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { act, create } from "react-test-renderer";

import { ProfileMenu } from "./profile-menu";

const originalActEnvironment = Object.getOwnPropertyDescriptor(
  globalThis,
  "IS_REACT_ACT_ENVIRONMENT",
);

afterEach(() => {
  if (originalActEnvironment) {
    Object.defineProperty(
      globalThis,
      "IS_REACT_ACT_ENVIRONMENT",
      originalActEnvironment,
    );
  } else {
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});

describe("ProfileMenu", () => {
  it("exposes the signed-in identity and invokes sign out", async () => {
    let signOutCount = 0;
    let renderer: ReturnType<typeof create> | undefined;
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });

    await act(async () => {
      renderer = create(
        <ProfileMenu
          name="Avery Agent"
          email="avery@example.test"
          role="admin"
          onSignOut={async () => {
            signOutCount += 1;
          }}
        />,
      );
    });

    const summary = renderer?.root.findByType("summary");
    assert.equal(summary?.props["aria-label"], "Account menu for Avery Agent");
    assert.ok(renderer?.root.findByProps({ children: "avery@example.test" }));

    await act(async () => {
      await renderer?.root.findByType("button").props.onClick();
    });

    assert.equal(signOutCount, 1);
    await act(async () => renderer?.unmount());
  });
});
