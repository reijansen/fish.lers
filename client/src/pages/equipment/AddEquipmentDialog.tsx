import { useState } from "react";
import { Plus } from "lucide-react";
import { Equipment, Category } from "../../db"; // Import Category interface
import EquipmentForm from "./EquipmentForm";

interface AddEquipmentDialogConfig {
  onAdd: (equipment: Omit<Equipment, "equipmentID">) => Promise<void>;
  categories: Category[]; // Receive dynamic categories from Dashboard
}

// Helper to create a fresh initial state
const getInitialForm = (defaultCategoryID: string): Omit<Equipment, "equipmentID"> => ({
  name: "",
  totalInventory: 1,
  categoryID: defaultCategoryID, // Use ID instead of name
  isDisposable: false,
  imageLink: "",
});

export default function AddEquipmentDialog({ onAdd, categories }: AddEquipmentDialogConfig) {
  const [open, setOpen] = useState(false);

  // Set the default selection to the first category ID available, or empty string
  const defaultID = categories.length > 0 ? (categories[0].categoryID || "") : "";

  const [form, setForm] = useState<Omit<Equipment, "equipmentID">>(getInitialForm(defaultID));

  // Reset form when dialog opens to ensure it picks up any new default category logic
  const handleOpen = () => {
    setForm(getInitialForm(defaultID));
    setOpen(true);
  };

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const target = e.target;
    const { name } = target;

    let newValue: string | number | boolean = target.value;

    if (target instanceof HTMLInputElement) {
      if (target.type === "number") {
        newValue = Number(target.value);
      } else if (target.type === "checkbox") {
        newValue = target.checked;
      }
    }

    setForm((prev) => ({ ...prev, [name]: newValue }));
  }

  async function handleSubmit() {
    // Validation: name is required, inventory > 0, and a category must be selected
    const isValid = form.name.trim() !== "" && form.totalInventory > 0 && form.categoryID !== "";

    if (!isValid) {
      console.log("Invalid form submission attempt");
      return;
    }

    try {
      await onAdd(form); // Save to Firebase via the logicEquipment handler
      setOpen(false); // Close modal
      setForm(getInitialForm(defaultID)); // Reset form for next use
    } catch (error) {
      console.error("Error saving equipment:", error);
    }
  }

  return (
    <>
      <button className="btn btn-primary btn-sm gap-2" onClick={handleOpen}>
        <Plus className="w-4 h-4" />
        <span>Add New Equipment</span>
      </button>

      {open && (
        <div
          className="modal modal-open"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="modal-box w-full max-w-lg max-h-[85dvh] overflow-y-auto p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg mb-4">Add New Equipment</h3>

            {/* Pass the dynamic categories to the form */}
            <EquipmentForm
              form={form}
              categories={categories}
              onChange={handleChange}
            />

            <div className="modal-action sticky bottom-0 bg-base-100 pt-3">
              <button
                className="btn btn-success"
                onClick={handleSubmit}
                disabled={!form.name.trim() || form.totalInventory <= 0 || !form.categoryID}
              >
                Add
              </button>
              <button className="btn btn-error" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
