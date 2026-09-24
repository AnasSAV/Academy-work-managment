"use client";

import { createContext, useContext, useId, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/actions/helpers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FieldErrors } from "@/lib/validation/parse";
import { cn } from "@/lib/utils";

const FieldErrorsContext = createContext<FieldErrors>({});

interface FormDialogProps<T> {
  title: string;
  description?: string;
  triggerLabel: ReactNode;
  triggerVariant?: "default" | "outline" | "ghost" | "secondary";
  triggerSize?: "default" | "sm" | "xs" | "icon" | "icon-sm" | "icon-xs";
  triggerAriaLabel?: string;
  submitLabel?: string;
  successMessage?: string;
  action: (formData: FormData) => Promise<ActionResult<T>>;
  onSuccess?: (data: T) => void;
  className?: string;
  children: ReactNode;
}

/** A button that opens a dialog containing a form wired to a server action. */
export function FormDialog<T>({
  title,
  description,
  triggerLabel,
  triggerVariant = "default",
  triggerSize = "default",
  triggerAriaLabel,
  submitLabel = "Save",
  successMessage,
  action,
  onSuccess,
  className,
  children,
}: FormDialogProps<T>) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setError(null);
      setFieldErrors({});
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        if (successMessage) toast.success(successMessage);
        handleOpenChange(false);
        onSuccess?.(result.data);
      } else {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant={triggerVariant} size={triggerSize} aria-label={triggerAriaLabel} />
        }
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className={cn("sm:max-w-md", className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <FieldErrorsContext.Provider value={fieldErrors}>{children}</FieldErrorsContext.Provider>
          {error && !Object.keys(fieldErrors).length && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter showCloseButton>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type FieldProps = {
  name: string;
  label: string;
  hint?: string;
  multiline?: boolean;
  rows?: number;
} & Omit<React.ComponentProps<"input">, "name" | "id" | "children" | "ref">;

/** A labelled input that shows the server-side validation error for its field. */
export function Field({ name, label, hint, multiline, rows = 3, className, ...rest }: FieldProps) {
  const errors = useContext(FieldErrorsContext);
  const id = useId();
  const error = errors[name];
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea
          id={id}
          name={name}
          rows={rows}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={className}
          defaultValue={rest.defaultValue as string | undefined}
          placeholder={rest.placeholder}
          required={rest.required}
        />
      ) : (
        <Input
          id={id}
          name={name}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={className}
          {...rest}
        />
      )}
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface SelectFieldProps {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  hint?: string;
}

/** A labelled native select that shows the server-side validation error for its field. */
export function SelectField({ name, label, options, defaultValue = "", hint }: SelectFieldProps) {
  const errors = useContext(FieldErrorsContext);
  const id = useId();
  const error = errors[name];

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={!!error}
        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

/** A labelled checkbox; submits "on" when ticked and nothing otherwise. */
export function CheckboxField({
  name,
  label,
  hint,
  defaultChecked,
  disabled,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          disabled={disabled}
          className="accent-primary size-4"
        />
        <Label htmlFor={id}>{label}</Label>
      </div>
      {hint && <p className="text-muted-foreground pl-6 text-xs">{hint}</p>}
    </div>
  );
}
