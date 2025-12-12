function resetUserForm() {
  userForm?.reset();
  if (userForm?.elements?.id) userForm.elements.id.value = "";
  if (userMessage) {
    userMessage.textContent = "";
    userMessage.className = "small";
  }
  if (saveUserBtn) saveUserBtn.textContent = "Create user";
}

function closeUserModal() {
  if (userModal) userModal.style.display = "none";
  resetUserForm();
}

function openUserModal(user) {
  resetUserForm();
  if (user) {
    if (userForm?.elements?.id) userForm.elements.id.value = user._id || "";
    if (userForm?.elements?.username)
      userForm.elements.username.value = user.username || "";
    if (userForm?.elements?.name)
      userForm.elements.name.value = user.name || "";
    if (userForm?.elements?.role)
      userForm.elements.role.value = user.role || "student";
    if (userForm?.elements?.active)
      userForm.elements.active.value = user.active ? "true" : "false";
    if (saveUserBtn) saveUserBtn.textContent = "Update user";
  }
  if (userModal) userModal.style.display = "flex";
}

newUserBtn?.addEventListener("click", () => openUserModal());
closeUserModalBtn?.addEventListener("click", closeUserModal);
cancelUserBtn?.addEventListener("click", closeUserModal);

const resetGroupModal = () => {
  if (groupModal) groupModal.style.display = "none";
  groupForm?.reset();
  if (groupModalTrackingList) setTrackingRows(groupModalTrackingList, []);
  editingGroupId = null;
  if (groupMessage) {
    groupMessage.textContent = "";
  }
};
closeGroup?.addEventListener("click", resetGroupModal);
cancelGroup?.addEventListener("click", resetGroupModal);

function setVendorFormMode(mode) {
  vendorFormMode = mode === "builtin" ? "builtin" : "custom";
  if (vendorForm) vendorForm.dataset.mode = vendorFormMode;
  if (vendorCustomPanel)
    vendorCustomPanel.style.display =
      vendorFormMode === "custom" ? VENDOR_CUSTOM_DISPLAY : "none";
  if (vendorBuiltinPanel)
    vendorBuiltinPanel.style.display =
      vendorFormMode === "builtin" ? "block" : "none";
  if (vendorSaveBtn)
    vendorSaveBtn.textContent =
      vendorFormMode === "builtin" ? "Save settings" : "Save vendor";
}

function renderBuiltinCapabilities(vendor) {
  if (!builtinVendorCapabilities) return;
  const caps = Object.entries(vendor?.capabilities || {}).filter(
    ([, enabled]) => enabled,
  );
  if (!caps.length) {
    builtinVendorCapabilities.innerHTML = "";
    return;
  }
  builtinVendorCapabilities.innerHTML = caps
    .map(
      ([key]) =>
        `<span style="padding:2px 8px; border-radius:999px; background:var(--border); font-size:12px;">${BUILTIN_CAPABILITY_LABELS[key] || key}</span>`,
    )
    .join("");
}

function renderBuiltinFields(vendor) {
  builtinFieldInputs = [];
  if (!builtinFieldsContainer) return;
  const fields = vendor?.integrationFields || [];
  if (!fields.length) {
    builtinFieldsContainer.innerHTML =
      '<div class="small">No configuration required for this vendor.</div>';
    return;
  }
  builtinFieldsContainer.innerHTML = "";
  fields.forEach((field) => {
    const labelText = field.label || field.key;
    const wrapper = document.createElement("div");
    const label = document.createElement("label");
    label.className = "small";
    label.textContent = labelText;
    const input = document.createElement("input");
    input.className = "input";
    input.type = field.type === "password" ? "password" : "text";
    input.placeholder = field.placeholder || "";
    if (field.value) input.value = field.value;
    input.required = Boolean(field.required);
    wrapper.appendChild(label);
    wrapper.appendChild(input);
    builtinFieldsContainer.appendChild(wrapper);
    builtinFieldInputs.push({
      key: field.key,
      input,
      required: Boolean(field.required),
      label: labelText,
    });
  });
}

function populateBuiltinVendor(vendor) {
  activeBuiltinVendor = vendor || null;
  if (!vendorForm?.elements?.integrationKey) return;
  vendorForm.elements.integrationKey.value = vendor?.key || vendor?.slug || "";
  if (!vendor) return;
  setVendorFormMode("builtin");
  if (builtinVendorDescription) {
    const status = vendor.requiresCredentials
      ? vendor.hasCredentialsConfigured
        ? "Configured"
        : "Missing credentials"
      : "No configuration required";
    builtinVendorDescription.textContent =
      `${vendor.description || ""} ${status ? `(${status})` : ""}`.trim();
  }
  renderBuiltinCapabilities(vendor);
  renderBuiltinFields(vendor);
}

function resetVendorForm() {
  vendorForm?.reset();
  if (vendorForm?.elements?.id) vendorForm.elements.id.value = "";
  if (vendorForm?.elements?.integrationKey)
    vendorForm.elements.integrationKey.value = "";
  if (vendorMessage) {
    vendorMessage.textContent = "";
    vendorMessage.className = "small";
  }
  builtinFieldInputs = [];
  activeBuiltinVendor = null;
  setVendorFormMode("custom");
  if (builtinFieldsContainer) builtinFieldsContainer.innerHTML = "";
  if (builtinVendorDescription) builtinVendorDescription.textContent = "";
  if (builtinVendorCapabilities) builtinVendorCapabilities.innerHTML = "";
  const resultsEl = document.getElementById("extract-results");
  if (resultsEl) resultsEl.textContent = "";
  const previewNameEl = document.getElementById("preview-name");
  const previewPriceEl = document.getElementById("preview-price");
  const pickNameEl = document.getElementById("pick-name");
  const pickPriceEl = document.getElementById("pick-price");
  const selectorSnippetEl = document.getElementById("selector-snippet");
  if (previewNameEl) previewNameEl.textContent = "";
  if (previewPriceEl) previewPriceEl.textContent = "";
  if (pickNameEl) pickNameEl.innerHTML = "";
  if (pickPriceEl) pickPriceEl.innerHTML = "";
  if (selectorSnippetEl) selectorSnippetEl.value = "";
  if (testUrl) testUrl.value = "";
}

function closeVendorModal() {
  if (vendorModal) vendorModal.style.display = "none";
  resetVendorForm();
}

function openVendorModal(vendor) {
  resetVendorForm();
  if (vendor?.source === "builtin") {
    populateBuiltinVendor(vendor);
  } else if (vendor) {
    setVendorFormMode("custom");
    if (vendorForm?.elements?.id)
      vendorForm.elements.id.value = vendor._id || "";
    vendorForm.elements.vendor.value = vendor.vendor || "";
    vendorForm.elements.baseUrl.value = vendor.baseUrl || "";
    vendorForm.elements.productUrlTemplate.value =
      vendor.productUrlTemplate || "";
    vendorForm.elements.partNumberExample.value =
      vendor.partNumberExample || "";
    vendorForm.elements.partNumberPattern.value =
      vendor.partNumberPattern || "";
    vendorForm.elements.nameSelector.value = vendor.nameSelector || "";
    vendorForm.elements.priceSelector.value = vendor.priceSelector || "";
    vendorForm.elements.notes.value = vendor.notes || "";
  } else {
    setVendorFormMode("custom");
  }
  if (vendorModal) vendorModal.style.display = "flex";
}

newVendorBtn?.addEventListener("click", () => openVendorModal());
closeVendorModalBtn?.addEventListener("click", closeVendorModal);
cancelVendorBtn?.addEventListener("click", closeVendorModal);

attachBackdropClose(modal, () => {
  modal.style.display = "none";
});
attachBackdropClose(groupModal, resetGroupModal);
attachBackdropClose(groupDetailModal, () => {
  if (groupDetailModal) groupDetailModal.style.display = "none";
});
closeGroupDetail?.addEventListener("click", () => {
  if (groupDetailModal) groupDetailModal.style.display = "none";
});
attachBackdropClose(accountModal, () => {
  accountModal.style.display = "none";
});
attachBackdropClose(tagsModal, () => {
  tagsModal.style.display = "none";
});
attachBackdropClose(adminModal, () => {
  adminModal.style.display = "none";
});
attachBackdropClose(catalogModal, () => {
  catalogModal.style.display = "none";
  if (catalogItemModal) catalogItemModal.style.display = "none";
});
attachBackdropClose(catalogCategoryNewModal, () => {
  catalogCategoryNewModal.style.display = "none";
});
attachBackdropClose(catalogCategoryEditModal, () => {
  catalogCategoryEditModal.style.display = "none";
});
attachBackdropClose(catalogItemModal, () => {
  catalogItemModal.style.display = "none";
  resetCatalogItemForm();
});
attachBackdropClose(catalogRequestModal, () => {
  catalogRequestModal.style.display = "none";
  pendingCatalogRequest = null;
});
attachBackdropClose(stockModal, () => {
  if (stockModal) stockModal.style.display = "none";
  resetStockModal();
});
attachBackdropClose(stockSubteamsModal, () => {
  if (stockSubteamsModal) stockSubteamsModal.style.display = "none";
});
attachBackdropClose(stockDeleteModal, () => {
  if (stockDeleteModal) stockDeleteModal.style.display = "none";
  pendingDeleteStockId = null;
});
attachBackdropClose(confirmModal, () => {
  if (confirmModal) confirmModal.style.display = "none";
  pendingConfirmAction = null;
});
attachBackdropClose(vendorModal, closeVendorModal);
attachBackdropClose(userModal, closeUserModal);

async function fetchCatalogDetails() {
  if (!currentUser) return;
  const vendorInput = catalogItemForm?.elements?.vendor;
  const partInput = catalogItemForm?.elements?.vendorPartNumber;
  const linkInput = catalogItemForm?.elements?.supplierLink;
  const fetchPartInput =
    document.getElementById("fetch-catalog-part-number") || partInput;
  const fetchLinkInput =
    document.getElementById("fetch-catalog-link") || linkInput;
  const nameInput = catalogItemForm?.elements?.name;
  const priceInput = catalogItemForm?.elements?.unitCost;
  const vendor = vendorInput?.value?.trim();
  const partProvided = Boolean(fetchPartInput?.value?.trim());
  const linkProvided = Boolean(fetchLinkInput?.value?.trim());
  let partNumber = fetchPartInput?.value?.trim() || "";
  const link = fetchLinkInput?.value?.trim();
  const config = detectVendor(partNumber, link) || findVendorConfig(vendor);
  if (!partNumber && config && link) {
    const extracted = extractPartNumberFromUrl(config, link);
    if (extracted) {
      if (fetchPartInput && !linkProvided) fetchPartInput.value = extracted;
      if (partInput) partInput.value = extracted;
      partNumber = extracted;
    }
  }
  if (!partNumber && config?.source === "builtin" && link) {
    const resolved = await resolveBuiltinVendorPart(config, link);
    if (resolved?.partNumber) {
      if (fetchPartInput && !linkProvided) fetchPartInput.value = resolved.partNumber;
      if (partInput) partInput.value = resolved.partNumber;
      partNumber = resolved.partNumber;
    }
    if (resolved?.productUrl) {
      if (fetchLinkInput && !partProvided && !fetchLinkInput.value)
        fetchLinkInput.value = resolved.productUrl;
      if (linkInput && !linkInput.value) linkInput.value = resolved.productUrl;
    }
  }
  if (config?.vendor && vendorInput) vendorInput.value = config.vendor;
  const isBuiltin = config?.source === "builtin";
  if (isBuiltin && !partNumber) {
    catalogItemMessage.textContent = `Enter a part number to fetch from ${config.vendor}.`;
    catalogItemMessage.className = "error";
    return;
  }
  const url = isBuiltin ? null : deriveUrl(config, partNumber, link) || link;
  catalogItemMessage.textContent = "Fetching...";
  catalogItemMessage.className = "small";
  if (!isBuiltin && !url) {
    catalogItemMessage.textContent =
      "Provide a vendor link or part number first.";
    catalogItemMessage.className = "error";
    return;
  }
  if (!config && !url) {
    catalogItemMessage.textContent =
      "Provide a link or pick a supported vendor.";
    catalogItemMessage.className = "error";
    return;
  }
  const body = isBuiltin
    ? { vendorKey: config.key, partNumber }
    : {
        url,
        selectors: {
          nameSelector: config?.nameSelector,
          priceSelector: config?.priceSelector,
        },
      };
  try {
    const res = await fetch("/api/vendors/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Fetch failed");

    const pickName = data.picks?.name || data.candidates?.titles?.[0]?.text;
    const pickPrice = data.picks?.price || data.candidates?.prices?.[0]?.text;
    if (
      data.message &&
      !pickName &&
      (pickPrice === undefined || pickPrice === null)
    ) {
      throw new Error(data.message);
    }

    if (pickName && nameInput) nameInput.value = pickName;
    const priceNum = parsePrice(pickPrice);
    if (priceNum !== undefined && priceInput) {
      priceInput.value = priceNum;
    }
    const meta = data.meta || {};
    if (meta.manufacturerPartNumber && partInput) {
      partInput.value = meta.manufacturerPartNumber;
    } else if (partNumber && partInput) {
      partInput.value = partNumber;
    }
    if (meta.manufacturerPartNumber && fetchPartInput && !linkProvided) {
      fetchPartInput.value = meta.manufacturerPartNumber;
    } else if (partNumber && fetchPartInput && !linkProvided) {
      fetchPartInput.value = partNumber;
    }
    if (isBuiltin && data.productUrl && linkInput) {
      linkInput.value = data.productUrl;
      if (fetchLinkInput && !partProvided) {
        fetchLinkInput.value = data.productUrl;
      }
    } else if (!isBuiltin && linkInput) {
      linkInput.value = url;
      if (fetchLinkInput && !partProvided) {
        fetchLinkInput.value = url;
      }
    }
    if (config?.vendor && vendorInput) vendorInput.value = config.vendor;

    catalogItemMessage.textContent = "Fetched. Verify fields before saving.";
    catalogItemMessage.className = "success";
  } catch (err) {
    catalogItemMessage.textContent =
      err.message || "Fetch failed. Fill manually.";
    catalogItemMessage.className = "error";
  }
}
