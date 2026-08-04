import { z } from "zod";

export const signUpSchema = z
  .object({
    displayName: z.string().max(100, "Tên hiển thị không được vượt quá 100 ký tự").optional(),
    email: z.string().min(1, "Vui lòng nhập email").email("Email không hợp lệ"),
    password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự"),
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu"),
  })
  .superRefine((data, ctx) => {
    if (data.displayName !== undefined && data.displayName.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tên hiển thị không được chỉ chứa khoảng trắng",
        path: ["displayName"],
      });
    }

    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Mật khẩu xác nhận không khớp",
        path: ["confirmPassword"],
      });
    }
  });

export const signInSchema = z.object({
  email: z.string().min(1, "Vui lòng nhập email").email("Email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;

export function validateSignUp(data: unknown) {
  return signUpSchema.safeParse(data);
}

export function validateSignIn(data: unknown) {
  return signInSchema.safeParse(data);
}
