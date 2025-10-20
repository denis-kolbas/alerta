import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

interface CollapsibleStepperStep {
  title: string
  description?: string
  summary?: string
  content: React.ReactNode
}

interface CollapsibleStepperProps {
  steps: CollapsibleStepperStep[]
  currentStep: number
  onStepChange: (step: number) => void
}

export function CollapsibleStepper({ steps, currentStep, onStepChange }: CollapsibleStepperProps) {
  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep
        const isCurrent = index === currentStep
        const isDisabled = index > currentStep

        return (
          <div
            key={index}
            className={cn(
              "border rounded-lg transition-all",
              isCurrent && "border-primary shadow-sm",
              isCompleted && "border-muted",
              isDisabled && "border-muted opacity-60"
            )}
          >
            <div
              className={cn(
                "w-full flex items-center justify-between p-4 transition-colors",
                (isCompleted || isCurrent) && "cursor-pointer hover:bg-muted/50",
                isDisabled && "cursor-not-allowed"
              )}
              onClick={() => {
                if (isCompleted) {
                  onStepChange(index)
                }
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold flex-shrink-0",
                    isCompleted && "border-primary bg-primary text-primary-foreground",
                    isCurrent && "border-primary text-primary",
                    isDisabled && "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={cn(
                    "font-semibold",
                    isCurrent && "text-foreground",
                    !isCurrent && "text-muted-foreground"
                  )}>
                    {step.title}
                  </h3>
                  {step.description && !isCompleted && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {step.description}
                    </p>
                  )}
                  {step.summary && isCompleted && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {step.summary}
                    </p>
                  )}
                </div>
              </div>
              {isCompleted && (
                <span className="text-sm text-primary font-medium flex-shrink-0">
                  Edit
                </span>
              )}
              {isCurrent && (
                <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              )}
            </div>

            {isCurrent && (
              <div className="px-4 pb-4 pt-2 border-t">
                {step.content}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
