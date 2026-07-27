import eslintJs from "@eslint/js";

export default [
	{
		ignores: ["node_modules/", "pnpm-lock.yaml"],
	},
	eslintJs.configs.recommended,
];
