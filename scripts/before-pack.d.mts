interface AppImagePackContext {
  readonly electronPlatformName: string;
  readonly targets: readonly { readonly name: string }[];
  readonly packager: { readonly projectDir: string };
}

export default function beforePack(context: AppImagePackContext): Promise<void>;
