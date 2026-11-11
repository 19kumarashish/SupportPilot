import { z } from "zod";

const optionalText = (maximum: number) =>
  z.union([z.string().trim().max(maximum), z.literal("")]).optional();

export const customerInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a customer name.").max(200),
  email: z.union([
    z.literal(""),
    z.string().trim().email("Enter a valid email address.").max(255).toLowerCase(),
  ]).optional(),
  phone: z.union([
    z.literal(""),
    z.string().trim().min(7, "Enter at least 7 phone characters.").max(30),
  ]).optional(),
  company: optionalText(200),
}).strict();

export const userInputSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(255),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
  firstName: z.string().trim().min(1, "Enter a first name.").max(100),
  lastName: z.string().trim().min(1, "Enter a last name.").max(100),
  role: z.enum(["admin", "agent"]),
}).strict();

export const userUpdateSchema = userInputSchema.omit({ password: true });

export type CustomerInput = z.infer<typeof customerInputSchema>;
export type UserInput = z.infer<typeof userInputSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export function searchCurrentCustomers<T extends { name: string; email: string | null; company: string | null }>(
  customers: T[],
  query: string,
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return customers;

  return customers.filter((customer) =>
    [customer.name, customer.email, customer.company]
      .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery)),
  );
}
