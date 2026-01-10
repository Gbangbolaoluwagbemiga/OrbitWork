import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CASPER_TESTNET_TOKENS } from "@/config/casper-tokens";

interface ProjectDetailsStepProps {
  formData: {
    projectTitle: string;
    projectDescription: string;
    duration: string;
    totalBudget: string;
    beneficiary: string;
    token: string;
    useNativeToken: boolean;
    isOpenJob: boolean;
  };
  onUpdate: (data: Partial<ProjectDetailsStepProps["formData"]>) => void;
  isContractPaused: boolean;
  errors?: {
    projectTitle?: string;
    projectDescription?: string;
    duration?: string;
    totalBudget?: string;
    beneficiary?: string;
    tokenAddress?: string;
  };
}

export function ProjectDetailsStep({
  formData,
  onUpdate,
  isContractPaused,
  errors = {} as ProjectDetailsStepProps["errors"],
}: ProjectDetailsStepProps) {
  return (
    <Card className="glass border-primary/20 p-6">
      <CardHeader>
        <CardTitle>Project Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {isContractPaused && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Contract is currently paused. Escrow creation is temporarily
              disabled.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="projectTitle" className="mb-2 block">
              Project Title *
            </Label>
            <Input
              id="projectTitle"
              value={formData.projectTitle}
              onChange={(e) => onUpdate({ projectTitle: e.target.value })}
              placeholder="Enter project title"
              required
              minLength={3}
              className={
                errors?.projectTitle
                  ? "border-red-500 focus:border-red-500"
                  : ""
              }
            />
            {errors?.projectTitle && (
              <p className="text-red-500 text-sm mt-1">{errors.projectTitle}</p>
            )}
          </div>

          <div>
            <Label htmlFor="duration" className="mb-2 block">
              Duration (days) *
            </Label>
            <Input
              id="duration"
              type="number"
              value={formData.duration}
              onChange={(e) => onUpdate({ duration: e.target.value })}
              placeholder="e.g., 30"
              min="1"
              max="365"
              required
              className={
                errors?.duration ? "border-red-500 focus:border-red-500" : ""
              }
            />
            {errors?.duration && (
              <p className="text-red-500 text-sm mt-1">{errors.duration}</p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="projectDescription" className="mb-2 block">
            Project Description *
          </Label>
          <Textarea
            id="projectDescription"
            value={formData.projectDescription}
            onChange={(e) => onUpdate({ projectDescription: e.target.value })}
            placeholder="Describe the project requirements and deliverables..."
            className={`min-h-[120px] ${
              errors?.projectDescription
                ? "border-red-500 focus:border-red-500"
                : ""
            }`}
            required
            minLength={50}
          />
          {errors?.projectDescription ? (
            <p className="text-red-500 text-sm mt-1">
              {errors.projectDescription}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Minimum 50 characters required
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="totalBudget" className="mb-2 block">
              Total Budget (tokens) *
            </Label>
            <Input
              id="totalBudget"
              type="number"
              value={formData.totalBudget}
              onChange={(e) => onUpdate({ totalBudget: e.target.value })}
              placeholder="e.g., 1000"
              min="0.01"
              step="0.01"
              required
              className={
                errors?.totalBudget ? "border-red-500 focus:border-red-500" : ""
              }
            />
            {errors?.totalBudget ? (
              <p className="text-red-500 text-sm mt-1">{errors.totalBudget}</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Minimum 0.01 tokens required
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="beneficiary" className="mb-2 block">
              Beneficiary Address {!formData.isOpenJob && "*"}
            </Label>
            <Input
              id="beneficiary"
              value={formData.beneficiary}
              onChange={(e) => onUpdate({ beneficiary: e.target.value })}
              placeholder="01..."
              disabled={formData.isOpenJob}
              required={!formData.isOpenJob}
              pattern="^(01|02)[0-9a-fA-F]{64}$"
              className={
                errors?.beneficiary ? "border-red-500 focus:border-red-500" : ""
              }
            />
            {errors?.beneficiary ? (
              <p className="text-red-500 text-sm mt-1">{errors.beneficiary}</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                {formData.isOpenJob
                  ? "Leave empty for open job applications"
                  : "Valid Casper public key required for direct escrow"}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-6 mt-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="useNativeToken"
              checked={formData.useNativeToken}
              onChange={(e) => onUpdate({ useNativeToken: e.target.checked })}
              className="rounded w-4 h-4"
            />
            <Label htmlFor="useNativeToken" className="cursor-pointer">
              Use Native Token (CSPR)
            </Label>
          </div>

          {!formData.useNativeToken && (
            <div>
              <Label htmlFor="tokenAddress" className="mb-2 block">
                Token Address *
              </Label>
              <div className="space-y-2">
                <Select 
                  value={CASPER_TESTNET_TOKENS.some(t => t.address === formData.token) ? formData.token : "custom"} 
                  onValueChange={(val) => {
                    if (val !== "custom") onUpdate({ token: val });
                    else onUpdate({ token: "" }); // Reset if custom selected to allow typing
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a whitelisted token" />
                  </SelectTrigger>
                  <SelectContent>
                    {CASPER_TESTNET_TOKENS.map((t) => (
                      <SelectItem key={t.address} value={t.address}>
                        {t.name} ({t.symbol})
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom Address</SelectItem>
                  </SelectContent>
                </Select>
                {(!CASPER_TESTNET_TOKENS.some(t => t.address === formData.token) || formData.token === "") && (
                    <Input
                      id="tokenAddress"
                      value={formData.token}
                      onChange={(e) => onUpdate({ token: e.target.value })}
                      placeholder="hash-..."
                      required
                      className={
                        errors?.tokenAddress ? "border-red-500 focus:border-red-500" : ""
                      }
                    />
                )}
              </div>
              {errors?.tokenAddress ? (
                <p className="text-red-500 text-sm mt-1">{errors.tokenAddress}</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the contract hash of your CEP-18 token
                </p>
              )}
            </div>
          )}

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="isOpenJob"
              checked={formData.isOpenJob}
              onChange={(e) => onUpdate({ isOpenJob: e.target.checked })}
              className="rounded w-4 h-4"
            />
            <Label htmlFor="isOpenJob" className="cursor-pointer">
              Open Job (Allow Applications)
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
