import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useCasper } from "@/contexts/casper-context";
import { useCasperEscrow } from "@/hooks/use-casper-escrow";
// Unused import removed: useSmartAccount
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { useNavigate } from "react-router-dom";
import { ProjectDetailsStep } from "@/components/create/project-details-step";
import { MilestonesStep } from "@/components/create/milestones-step";
import { ReviewStep } from "@/components/create/review-step";
import { useCreateEscrow } from "@/hooks/use-escrows";

interface Milestone {
  description: string;
  amount: string;
}

export default function CreateEscrowPage() {
  const navigate = useNavigate();
  const { isConnected: isCasperConnected, address: casperAddress } = useCasper();
  const { createEscrow: createCasperEscrow, isLoading: isCasperLoading } = useCasperEscrow();
  const { toast } = useToast();
  const createEscrow = useCreateEscrow();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAIWriter, setShowAIWriter] = useState(false);
  const [currentMilestoneIndex, setCurrentMilestoneIndex] = useState<
    number | null
  >(null);
  const [_useNativeToken, _setUseNativeToken] = useState(false);
  const [_isOpenJob, _setIsOpenJob] = useState(false);
  const [isContractPaused, setIsContractPaused] = useState(false);
  const [isOnCorrectNetwork, setIsOnCorrectNetwork] = useState(true);
  const [errors, setErrors] = useState<{
    projectTitle?: string;
    projectDescription?: string;
    duration?: string;
    totalBudget?: string;
    beneficiary?: string;
    tokenAddress?: string;
    milestones?: string;
    totalMismatch?: string;
  }>({});



  const checkNetworkStatus = useCallback(async () => {
    if (!isCasperConnected) return;

    try {
      // Check if connected to Casper Testnet
      setIsOnCorrectNetwork(true);
    } catch (error) {
      setIsOnCorrectNetwork(false);
    }
  }, [isCasperConnected]);

  const checkContractPauseStatus = useCallback(async () => {
    try {
      // TODO: Implement Casper pause check
      setIsContractPaused(false);
    } catch (error) {
      setIsContractPaused(false);
    }
  }, []);

  useEffect(() => {
    checkContractPauseStatus();
    checkNetworkStatus();
  }, [checkContractPauseStatus, checkNetworkStatus]);

  const [formData, setFormData] = useState({
    projectTitle: "",
    projectDescription: "",
    duration: "",
    totalBudget: "",
    beneficiary: "",
    token: "", // Use empty string for native CSPR, or contract hash for tokens
    useNativeToken: false,
    isOpenJob: false,
    milestones: [
      { description: "", amount: "" },
      { description: "", amount: "" },
    ] as Milestone[],
  });

  // Removed unused functions: _commonTokens, _addMilestone, _removeMilestone

  // Removed unused functions: updateMilestone, _openAIWriter, _handleAISelect

  const calculateTotalMilestones = () => {
    return formData.milestones.reduce(
      (sum, m) => sum + (Number.parseFloat(m.amount) || 0),
      0
    );
  };

  const validateStep = () => {
    const newErrors: typeof errors = {};
    let hasErrors = false;

    if (step === 1) {
      // Validate all required fields for step 1
      if (!formData.projectTitle || formData.projectTitle.length < 3) {
        newErrors.projectTitle = "Project title must be at least 3 characters";
        hasErrors = true;
      }

      if (
        !formData.projectDescription ||
        formData.projectDescription.length < 50
      ) {
        newErrors.projectDescription =
          "Project description must be at least 50 characters";
        hasErrors = true;
      }

      if (
        !formData.duration ||
        Number(formData.duration) < 1 ||
        Number(formData.duration) > 365
      ) {
        newErrors.duration = "Duration must be between 1 and 365 days";
        hasErrors = true;
      }

      if (!formData.totalBudget || Number(formData.totalBudget) < 0.01) {
        newErrors.totalBudget = "Total budget must be at least 0.01 tokens";
        hasErrors = true;
      }

      if (
        !formData.isOpenJob &&
        (!formData.beneficiary ||
          (isCasperConnected
            ? !/^(01|02)[0-9a-fA-F]{64}$/.test(formData.beneficiary)
            : false))
      ) {
        newErrors.beneficiary = isCasperConnected
          ? "Valid Casper public key (01/02 + hex) is required"
          : "Valid address is required";
        hasErrors = true;
      }

      if (
        !formData.useNativeToken &&
        (!formData.token ||
          (isCasperConnected
            ? !/^(hash-|account-hash-)?[0-9a-fA-F]{64}$/.test(formData.token)
            : false))
      ) {
        newErrors.tokenAddress = isCasperConnected
          ? "Valid Casper token hash is required"
          : "Valid token address is required";
        hasErrors = true;
      }
    } else if (step === 2) {
      const total = calculateTotalMilestones();
      const targetTotal = Number.parseFloat(formData.totalBudget) || 0;

      if (formData.milestones.some((m) => !m.description || !m.amount)) {
        newErrors.milestones = "Please fill in all milestone details";
        hasErrors = true;
      }

      if (Math.abs(total - targetTotal) > 0.01) {
        newErrors.totalMismatch = `Milestone amounts (${total}) must equal total amount (${targetTotal})`;
        hasErrors = true;
      }
    }

    setErrors(newErrors);
    return !hasErrors;
  };

  const clearErrors = () => {
    setErrors({});
  };

  const nextStep = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  const validateForm = () => {
    const errors: string[] = [];

    // Validate project title
    if (!formData.projectTitle || formData.projectTitle.length < 3) {
      errors.push("Project title must be at least 3 characters long");
    }

    // Validate project description
    if (
      !formData.projectDescription ||
      formData.projectDescription.length < 50
    ) {
      errors.push("Project description must be at least 50 characters long");
    }

    // Validate duration
    if (
      !formData.duration ||
      Number(formData.duration) < 1 ||
      Number(formData.duration) > 365
    ) {
      errors.push("Duration must be between 1 and 365 days");
    }

    // Validate total budget
    if (!formData.totalBudget || Number(formData.totalBudget) < 0.01) {
      errors.push("Total budget must be at least 0.01 tokens");
    }

    // Validate beneficiary (only if not open job)
    if (!formData.isOpenJob) {
      if (!formData.beneficiary) {
        errors.push("Beneficiary address is required for direct escrow");
      } else if (isCasperConnected) {
         // Casper address validation
         if (!/^(01|02)[0-9a-fA-F]{64}$/.test(formData.beneficiary)) {
            errors.push("Beneficiary address must be a valid Casper Public Key (starts with 01 or 02 followed by 64 hex chars)");
         }
      } else {
        errors.push("Wallet not connected");
      }
    }

    // Validate milestones
    if (formData.milestones.length === 0) {
      errors.push("At least one milestone is required");
    }

    for (let i = 0; i < formData.milestones.length; i++) {
      const milestone = formData.milestones[i];
      if (!milestone.description || milestone.description.length < 10) {
        errors.push(
          `Milestone ${i + 1} description must be at least 10 characters long`
        );
      }
      if (!milestone.amount || Number(milestone.amount) < 0.01) {
        errors.push(`Milestone ${i + 1} amount must be at least 0.01 tokens`);
      }
    }

    // Validate milestone amounts sum
    const totalMilestoneAmount = formData.milestones.reduce(
      (sum, milestone) => sum + Number(milestone.amount || 0),
      0
    );
    if (Math.abs(totalMilestoneAmount - Number(formData.totalBudget)) > 0.01) {
      errors.push("Total milestone amounts must equal the total budget");
    }

    return errors;
  };

  const handleSubmit = async () => {
    console.log("=== handleSubmit STARTED ===");
    
    // CASPER PATH
    if (isCasperConnected) {
        const validationErrors = validateForm();
        if (validationErrors.length > 0) {
            toast({
                title: "Form validation failed",
                description: validationErrors.join(", "),
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const deployHash = await createCasperEscrow({
                projectTitle: formData.projectTitle,
                projectDescription: formData.projectDescription,
                totalAmount: formData.totalBudget,
                duration: Number(formData.duration) * 24 * 60 * 60,
                milestones: formData.milestones,
                beneficiary: formData.isOpenJob ? undefined : formData.beneficiary
            });

            if (deployHash) {
                // Navigate after successful creation
                setTimeout(() => {
                    navigate(formData.isOpenJob ? "/jobs" : "/dashboard");
                }, 2000);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
        return;
    }

    toast({
      title: "Wallet not connected",
      description: "Please connect your Casper wallet to create an escrow",
      variant: "destructive",
    });
  };

  return (
    <div className="min-h-screen py-12 gradient-mesh">
      {/* Network Switch Banner */}
      {!isOnCorrectNetwork && isCasperConnected && (
        <div className="container mx-auto px-4 max-w-4xl mb-6">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                <div>
                  <h3 className="font-semibold text-destructive">
                    Wrong Network
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Please connect to Casper Testnet to create escrows
                  </p>
                </div>
              </div>
              <Button
                onClick={() => window.location.reload()}
                variant="destructive"
                size="sm"
              >
                Refresh Connection
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-3 text-center">
            Create New Escrow
          </h1>
          <p className="text-xl text-muted-foreground text-center mb-10">
            Set up a secure escrow with milestone-based payments
          </p>

          <div className="flex items-center justify-center mb-10">
            <div className="flex items-center gap-4">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-4">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                      s === step
                        ? "border-primary bg-primary text-primary-foreground"
                        : s < step
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    {s < step ? <CheckCircle2 className="h-5 w-5" /> : s}
                  </div>
                  {s < 3 && (
                    <div
                      className={`w-16 h-0.5 ${
                        s < step ? "bg-primary" : "bg-muted-foreground/30"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="mb-6"
              >
                <ProjectDetailsStep
                  formData={formData}
                  onUpdate={(data) => {
                    setFormData({ ...formData, ...data });
                    clearErrors();
                  }}
                  isContractPaused={isContractPaused}
                  errors={{
                    projectTitle: errors.projectTitle,
                    projectDescription: errors.projectDescription,
                    duration: errors.duration,
                    totalBudget: errors.totalBudget,
                    beneficiary: errors.beneficiary,
                    tokenAddress: errors.tokenAddress,
                  }}
                />
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="mb-6"
              >
                <MilestonesStep
                  milestones={formData.milestones}
                  onUpdate={(milestones) => {
                    setFormData({ ...formData, milestones });
                    clearErrors();
                  }}
                  showAIWriter={showAIWriter}
                  onToggleAIWriter={setShowAIWriter}
                  currentMilestoneIndex={currentMilestoneIndex}
                  onSetCurrentMilestoneIndex={setCurrentMilestoneIndex}
                  totalBudget={formData.totalBudget}
                  errors={{
                    milestones: errors.milestones,
                    totalMismatch: errors.totalMismatch,
                  }}
                />
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="mb-6"
              >
                <ReviewStep
                  formData={formData}
                  onConfirm={handleSubmit}
                  isSubmitting={isSubmitting || createEscrow.isPending}
                  isContractPaused={isContractPaused}
                  isOnCorrectNetwork={isOnCorrectNetwork}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-between mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={step === 1}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </Button>

            <Button
              type="button"
              onClick={nextStep}
              disabled={step === 3}
              className="flex items-center gap-2"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
