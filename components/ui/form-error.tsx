import { FormMessage } from "@/components_shadcn/ui/form";

export function FormError({ error }: { error?: string[] }) {
  if (!error || error.length === 0) return null;
  
  return (
    <>
      {error.map((err, index) => (
        <FormMessage key={index} className="text-xs italic font-medium text-pink-500 mb-0 pb-0">
          {err}
        </FormMessage>
      ))}
    </>
  );
}